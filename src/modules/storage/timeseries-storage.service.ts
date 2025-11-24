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

  /**
   * Insert an array of readings into the metric_readings hypertable.
   * Uses a single multi-row INSERT for efficiency.
   */
  async insertReadings(readings: TimeseriesReading[]): Promise<void> {
    if (!readings.length) {
      return;
    }

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

  /**
   * Retrieve readings for a given device + metric within a time range.
   * Results are ordered by ascending timestamp.
   */
  async getReadingsForDeviceMetric(
    deviceId: string,
    metricName: string,
    from: Date,
    to: Date,
  ): Promise<TimeseriesReading[]> {
    const query = `
      SELECT device_id, metric_name, ts, value
      FROM metric_readings
      WHERE device_id = $1
        AND metric_name = $2
        AND ts >= $3
        AND ts <= $4
      ORDER BY ts ASC
    `;

    const params = [deviceId, metricName, from, to];

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      deviceId: row.device_id,
      metricName: row.metric_name,
      ts: row.ts,
      value: Number(row.value),
    }));
  }
}
