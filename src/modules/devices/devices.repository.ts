import { Injectable, Logger } from "@nestjs/common";
import { Pool } from "pg";
import { randomBytes, randomUUID } from "crypto";
import { Device } from "./device.entity";
import { hashDeviceApiKey } from "./device-api-key.util";

@Injectable()
export class DevicesRepository {
  private readonly logger = new Logger(DevicesRepository.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "admin",
      database: process.env.DB_NAME ?? "postgres",
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

  async findById(id: string): Promise<Device | null> {
    const result = await this.pool.query(
      `
      SELECT id, name, api_key, active, created_at, updated_at
      FROM devices
      WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToDevice(result.rows[0]);
  }

  async createDevice(
    name: string,
  ): Promise<{ device: Device; apiKeyPlain: string }> {
    const id = randomUUID();
    const apiKeyPlain = randomBytes(32).toString("hex");
    const apiKeyHash = hashDeviceApiKey(apiKeyPlain);
    const active = true;
    const now = new Date();

    const result = await this.pool.query(
      `
      INSERT INTO devices (id, name, api_key, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, api_key, active, created_at, updated_at
      `,
      [id, name, apiKeyHash, active, now, now],
    );

    const device = this.mapRowToDevice(result.rows[0]);

    this.logger.log("Device created", {
      deviceId: device.id,
      name: device.name,
    });

    return { device, apiKeyPlain };
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
