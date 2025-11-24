import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

process.env.INGEST_API_KEY =
  process.env.INGEST_API_KEY || 'dev-api-key-change-me';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'admin';
process.env.DB_NAME = process.env.DB_NAME || 'postgres';

describe('IngestController (e2e)', () => {
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

  it('debería aceptar un payload válido y devolver status ok', async () => {
    const res = await request(app.getHttpServer())
      .post('/ingest')
      .set(
        'Authorization',
        `Bearer ${process.env.INGEST_API_KEY as string}`,
      )
      .send({
        device_id: '550e8400-e29b-41d4-a716-446655440000',
        metrics: [
          { name: 'temperature', value: 27.5, ts: '2025-01-01T12:00:00Z' },
          { name: 'humidity', value: 40.1 },
        ],
      })
      .expect(201);

    expect(res.body).toEqual({ status: 'ok', stored: 2 });
  });

  it('debería devolver 401 si falta la API key', async () => {
    await request(app.getHttpServer())
      .post('/ingest')
      .send({
        device_id: '550e8400-e29b-41d4-a716-446655440000',
        metrics: [{ name: 'temperature', value: 27.5 }],
      })
      .expect(401);
  });

  it('debería devolver 400 si el payload es inválido', async () => {
    await request(app.getHttpServer())
      .post('/ingest')
      .set(
        'Authorization',
        `Bearer ${process.env.INGEST_API_KEY as string}`,
      )
      .send({
        metrics: [],
      })
      .expect(400);
  });
});
