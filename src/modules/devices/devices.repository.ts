
import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { randomBytes, randomUUID } from 'crypto';
import { Device } from './device.entity';

@Injectable()
export class DevicesRepository {
  private readonly logger = new Logger(DevicesRepository.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'iot_live_metrics_hub',
    });
  }

  async findAll(): Promise<Device[]> {
    const result = await this.pool.query(
      `
      SELECT id, name, api_key, active, created_at, updated_at
      FROM devices
      ORDER BY created_at ASC
      `,
    );

    return result.rows.map((row) => this.mapRowToDevice(row));
  }

  async createDevice(name: string): Promise<Device> {
    const id = randomUUID();
    // Strong API key generation; hardening (hashing, rotation, binding) coming in F8.
    const apiKey = randomBytes(32).toString('hex');
    const active = true;
    const now = new Date();

    const result = await this.pool.query(
      `
      INSERT INTO devices (id, name, api_key, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, api_key, active, created_at, updated_at
      `,
      [id, name, apiKey, active, now, now],
    );

    const device = this.mapRowToDevice(result.rows[0]);

    this.logger.log('Device created', {
      deviceId: device.id,
      name: device.name,
    });

    return device;
  }

  private mapRowToDevice(row: any): Device {
    return new Device(
      row.id,
      row.name,
      row.api_key,
      row.active,
      new Date(row.created_at),
      new Date(row.updated_at),
    );
  }
}
