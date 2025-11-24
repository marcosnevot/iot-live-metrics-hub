import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { Pool } from "pg";
import { AppModule } from "../src/app.module";

describe("MetricsController (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;

  const deviceId = "550e8400-e29b-41d4-a716-446655440000";
  const metricName = "temperature_e2e";

  beforeAll(async () => {
    // Reuse the same defaults as TimeseriesStorageService
    pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "admin",
      database: process.env.DB_NAME || "postgres",
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean table and insert a fresh row for each test
    await pool.query("DELETE FROM metric_readings");

    const ts = new Date("2025-11-24T12:30:00Z");

    await pool.query(
      `
      INSERT INTO metric_readings (device_id, metric_name, ts, value)
      VALUES ($1, $2, $3, $4)
    `,
      [deviceId, metricName, ts, 21.5],
    );
  });

  it("returns points for device + metric within the requested time range", async () => {
    const from = "2025-11-24T12:00:00Z";
    const to = "2025-11-24T13:00:00Z";

    const response = await request(app.getHttpServer())
      .get(`/metrics/${deviceId}/${metricName}`)
      .query({ from, to })
      .expect(200);

    expect(response.body).toEqual({
      device_id: deviceId,
      metric_name: metricName,
      points: [
        expect.objectContaining({
          ts: expect.any(String),
          value: 21.5,
        }),
      ],
    });

    // Ensure ordering by ascending timestamp is respected (single point here)
    expect(response.body.points).toHaveLength(1);
  });

  it("returns an empty list of points when there is no data in the range", async () => {
    const from = "2025-11-24T13:00:00Z";
    const to = "2025-11-24T14:00:00Z";

    const response = await request(app.getHttpServer())
      .get(`/metrics/${deviceId}/${metricName}`)
      .query({ from, to })
      .expect(200);

    expect(response.body).toEqual({
      device_id: deviceId,
      metric_name: metricName,
      points: [],
    });
  });

  it("fails with 400 when from/to are missing", async () => {
    const res = await request(app.getHttpServer())
      .get(`/metrics/${deviceId}/${metricName}`)
      .expect(400);

    expect(res.body.message).toContain(
      "Query parameters 'from' and 'to' are required",
    );
  });

  it("fails with 400 when from > to", async () => {
    const from = "2025-11-24T14:00:00Z";
    const to = "2025-11-24T13:00:00Z";

    const res = await request(app.getHttpServer())
      .get(`/metrics/${deviceId}/${metricName}`)
      .query({ from, to })
      .expect(400);

    expect(res.body.message).toContain(
      "'from' timestamp must be earlier than or equal to 'to' timestamp",
    );
  });
});
