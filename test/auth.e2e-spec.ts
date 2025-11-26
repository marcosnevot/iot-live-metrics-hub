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

describe("AuthController (e2e)", () => {
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

  it("should login successfully with valid admin credentials", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      })
      .expect(201);

    expect(res.body).toHaveProperty("accessToken");
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("should fail with 401 when credentials are invalid", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: "invalid@user.test",
        password: "wrong-password",
      })
      .expect(401);
  });
});
