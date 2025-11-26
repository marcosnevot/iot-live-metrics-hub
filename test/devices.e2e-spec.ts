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

describe("DevicesController (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let analystAccessToken: string;

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

    const adminRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      })
      .expect(201);

    adminAccessToken = adminRes.body.accessToken as string;

    const analystRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: process.env.ANALYST_USERNAME,
        password: process.env.ANALYST_PASSWORD,
      })
      .expect(201);

    analystAccessToken = analystRes.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 when listing devices without JWT", async () => {
    await request(app.getHttpServer()).get("/devices").expect(401);
  });

  it("should allow analyst to list devices", async () => {
    const res = await request(app.getHttpServer())
      .get("/devices")
      .set("Authorization", `Bearer ${analystAccessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const first = res.body[0];

      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("active");
      expect(first).toHaveProperty("created_at");
      expect(first).toHaveProperty("updated_at");
    }
  });

  it("should forbid analyst from creating devices", async () => {
    await request(app.getHttpServer())
      .post("/devices")
      .set("Authorization", `Bearer ${analystAccessToken}`)
      .send({ name: "e2e-devices-analyst-forbidden" })
      .expect(403);
  });

  it("should allow admin to create devices", async () => {
    const res = await request(app.getHttpServer())
      .post("/devices")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "e2e-devices-admin" })
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name", "e2e-devices-admin");
    expect(res.body).toHaveProperty("api_key");
    expect(res.body).toHaveProperty("active");
    expect(res.body).toHaveProperty("created_at");
    expect(res.body).toHaveProperty("updated_at");
  });
});
