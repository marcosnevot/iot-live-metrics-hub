import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";

export interface TimeseriesReading {
  deviceId: string;
  metricName: string;
  ts: Date;
  value: number;
}

@Injectable()
export class TimeseriesStorageService implements OnModuleDestroy {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "admin",
      database: process.env.DB_NAME || "postgres",
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async insertReadings(readings: TimeseriesReading[]): Promise<void> {
    if (!readings.length) {
      return;
    }

    // Inserción por batch con VALUES múltiples
    const values: any[] = [];
    const placeholders: string[] = [];

    readings.forEach((r, index) => {
      const baseIndex = index * 4;
      placeholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`,
      );
      values.push(r.deviceId, r.metricName, r.ts, r.value);
    });

    const query = `
      INSERT INTO metric_readings (device_id, metric_name, ts, value)
      VALUES ${placeholders.join(", ")}
    `;

    await this.pool.query(query, values);
  }
}
