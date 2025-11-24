import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

process.env.INGEST_API_KEY =
  process.env.INGEST_API_KEY || "dev-api-key-change-me";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "admin";
process.env.DB_NAME = process.env.DB_NAME || "postgres";

describe("IngestController (e2e)", () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("should accept a valid payload and return ok status", async () => {
    const res = await request(app.getHttpServer())
      .post("/ingest")
      .set(
        "Authorization",
        `Bearer ${process.env.INGEST_API_KEY as string}`,
      )
      .send({
        device_id: "550e8400-e29b-41d4-a716-446655440000",
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
        device_id: "550e8400-e29b-41d4-a716-446655440000",
        metrics: [{ name: "temperature", value: 27.5 }],
      })
      .expect(401);
  });

  it("should return 400 when payload is invalid", async () => {
    await request(app.getHttpServer())
      .post("/ingest")
      .set(
        "Authorization",
        `Bearer ${process.env.INGEST_API_KEY as string}`,
      )
      .send({
        metrics: [],
      })
      .expect(400);
  });

  it("should create an ACTIVE alert when a metric violates a MAX rule", async () => {
    const deviceId = "11111111-2222-4444-8888-999999999999";
    const metricName = "temperature";

    // 1) Create a MAX rule via HTTP API
    const ruleRes = await request(app.getHttpServer())
      .post("/rules")
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

    // 2) Ingest a metric that violates the rule (value > max)
    const ingestRes = await request(app.getHttpServer())
      .post("/ingest")
      .set(
        "Authorization",
        `Bearer ${process.env.INGEST_API_KEY as string}`,
      )
      .send({
        device_id: deviceId,
        metrics: [{ name: metricName, value: 35 }],
      })
      .expect(201);

    expect(ingestRes.body).toEqual({ status: "ok", stored: 1 });

    // 3) Read ACTIVE alerts and verify that one alert matches our device/metric/value
    const alertsRes = await request(app.getHttpServer())
      .get("/alerts")
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
