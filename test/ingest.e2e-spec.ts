import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

// DB defaults for local/e2e
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "admin";
process.env.DB_NAME = process.env.DB_NAME || "postgres";

// Auth defaults for e2e (admin + analyst)
process.env.JWT_SECRET = process.env.JWT_SECRET || "replace-with-local-jwt-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
process.env.ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin@local.test";
process.env.ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "replace-with-admin-password";
process.env.ANALYST_USERNAME =
  process.env.ANALYST_USERNAME || "analyst@local.test";
process.env.ANALYST_PASSWORD =
  process.env.ANALYST_PASSWORD || "replace-with-analyst-password";

describe("IngestController (e2e)", () => {
  let app: INestApplication;

  let adminAccessToken: string;
  let deviceId: string;
  let deviceApiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();

    // 1) Login as admin to obtain a JWT for protected business APIs
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      })
      .expect(201);

    adminAccessToken = loginRes.body.accessToken as string;

    // 2) Create a real device to get device_id + api_key for ingest
    const deviceRes = await request(app.getHttpServer())
      .post("/devices")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "e2e-ingest-device" })
      .expect(201);

    deviceId = deviceRes.body.id as string;
    deviceApiKey = deviceRes.body.api_key as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("should accept a valid payload and return ok status", async () => {
    const res = await request(app.getHttpServer())
      .post("/ingest")
      .set("Authorization", `Bearer ${deviceApiKey}`)
      .send({
        device_id: deviceId,
        metrics: [
          { name: "temperature", value: 27.5, ts: "2025-01-01T12:00:00Z" },
          { name: "humidity", value: 40.1 },
        ],
      })
      .expect(201);

    expect(res.body).toEqual({ status: "ok", stored: 2 });
  });

  it("should return 401 when API key is missing", async () => {
    await request(app.getHttpServer())
      .post("/ingest")
      .send({
        device_id: deviceId,
        metrics: [{ name: "temperature", value: 27.5 }],
      })
      .expect(401);
  });

  it("should return 400 when payload is invalid", async () => {
    // En este caso queremos que pase el guard (API key + device_id correctos)
    // y falle por validación del payload (metrics vacío).
    await request(app.getHttpServer())
      .post("/ingest")
      .set("Authorization", `Bearer ${deviceApiKey}`)
      .send({
        device_id: deviceId,
        metrics: [],
      })
      .expect(400);
  });

  it("should create an ACTIVE alert when a metric violates a MAX rule", async () => {
    const metricName = "temperature_e2e_rule";

    // 1) Create a MAX rule via HTTP API (protegido por JWT admin)
    const ruleRes = await request(app.getHttpServer())
      .post("/rules")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        device_id: deviceId,
        metric_name: metricName,
        rule_type: "MAX",
        max_value: 30,
      })
      .expect(201);

    expect(ruleRes.body).toMatchObject({
      deviceId,
      metricName,
      ruleType: "MAX",
      maxValue: 30,
      enabled: true,
    });

    // 2) Ingest a metric that violates the rule (value > max) usando API key del dispositivo
    const ingestRes = await request(app.getHttpServer())
      .post("/ingest")
      .set("Authorization", `Bearer ${deviceApiKey}`)
      .send({
        device_id: deviceId,
        metrics: [{ name: metricName, value: 35 }],
      })
      .expect(201);

    expect(ingestRes.body).toEqual({ status: "ok", stored: 1 });

    // 3) Read ACTIVE alerts (protegido por JWT) y verificar que hay un alert que coincide
    const alertsRes = await request(app.getHttpServer())
      .get("/alerts")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .query({ status: "ACTIVE" })
      .expect(200);

    const alerts: any[] = alertsRes.body;

    const matchingAlerts = alerts.filter(
      (a) =>
        a.deviceId === deviceId &&
        a.metricName === metricName &&
        a.value === 35 &&
        a.status === "ACTIVE",
    );

    expect(matchingAlerts.length).toBeGreaterThan(0);
  });
});
