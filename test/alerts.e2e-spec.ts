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
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "replace-with-local-jwt-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
process.env.ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin@local.test";
process.env.ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "replace-with-admin-password";
process.env.ANALYST_USERNAME =
  process.env.ANALYST_USERNAME || "analyst@local.test";
process.env.ANALYST_PASSWORD =
  process.env.ANALYST_PASSWORD || "replace-with-analyst-password";

describe("AlertsController (e2e)", () => {
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

    // Login as admin
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      })
      .expect(201);

    adminAccessToken = loginRes.body.accessToken as string;

    // Create device
    const deviceRes = await request(app.getHttpServer())
      .post("/devices")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "e2e-alerts-device" })
      .expect(201);

    deviceId = deviceRes.body.id as string;
    deviceApiKey = deviceRes.body.api_key as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("should resolve an ACTIVE alert and change its status to RESOLVED", async () => {
    const metricName = "temperature_e2e_alert_resolve";

    // 1) Create a MAX rule for this metric
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

    // 2) Ingest a metric that violates the rule to generate an ACTIVE alert
    const ingestRes = await request(app.getHttpServer())
      .post("/ingest")
      .set("Authorization", `Bearer ${deviceApiKey}`)
      .send({
        device_id: deviceId,
        metrics: [{ name: metricName, value: 35 }],
      })
      .expect(201);

    expect(ingestRes.body).toEqual({ status: "ok", stored: 1 });

    // 3) Fetch ACTIVE alerts and pick one
    const activeAlertsRes = await request(app.getHttpServer())
      .get("/alerts")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .query({ status: "ACTIVE" })
      .expect(200);

    const activeAlerts: any[] = activeAlertsRes.body;

    const alertToResolve = activeAlerts.find(
      (a) =>
        a.deviceId === deviceId &&
        a.metricName === metricName &&
        a.value === 35 &&
        a.status === "ACTIVE",
    );

    expect(alertToResolve).toBeDefined();

    const alertId = alertToResolve.id as string;

    // 4) Resolve the alert
    const resolvedRes = await request(app.getHttpServer())
      .patch(`/alerts/${alertId}/resolve`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(resolvedRes.body).toMatchObject({
      id: alertId,
      deviceId,
      metricName,
      value: 35,
      status: "RESOLVED",
    });

    expect(resolvedRes.body.resolvedAt).toBeDefined();

    // 5) Confirm it no longer appears as ACTIVE
    const activeAfterResolveRes = await request(app.getHttpServer())
      .get("/alerts")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .query({ status: "ACTIVE" })
      .expect(200);

    const activeAfterResolve: any[] = activeAfterResolveRes.body;

    const stillActive = activeAfterResolve.find((a) => a.id === alertId);
    expect(stillActive).toBeUndefined();
  });
});
