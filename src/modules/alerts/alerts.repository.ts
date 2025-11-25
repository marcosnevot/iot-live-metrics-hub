import { Inject, Injectable, Logger } from "@nestjs/common";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { Alert, AlertStatus } from "./alert.entity";

export const ALERTS_PG_POOL = "ALERTS_PG_POOL";

interface AlertSearchCriteria {
  status?: AlertStatus;
  deviceId?: string;
  metricName?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AlertsRepository {
  private readonly logger = new Logger(AlertsRepository.name);

  constructor(@Inject(ALERTS_PG_POOL) private readonly pool: Pool) {}

  private mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      deviceId: row.device_id,
      metricName: row.metric_name,
      ruleId: row.rule_id,
      value: Number(row.value),
      status: row.status as AlertStatus,
      triggeredAt: new Date(row.triggered_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
    };
  }

  async createAlert(params: {
    deviceId: string;
    metricName: string;
    ruleId: string;
    value: number;
  }): Promise<Alert> {
    const { deviceId, metricName, ruleId, value } = params;
    const id = randomUUID();

    const result = await this.pool.query(
      `
      INSERT INTO alerts (
        id,
        device_id,
        metric_name,
        rule_id,
        value,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      RETURNING id, device_id, metric_name, rule_id, value, status, triggered_at, resolved_at
      `,
      [id, deviceId, metricName, ruleId, value],
    );

    return this.mapRowToAlert(result.rows[0]);
  }

  async findByCriteria(criteria: AlertSearchCriteria): Promise<Alert[]> {
    const { status, deviceId, metricName, from, to } = criteria;

    const conditions: string[] = [];
    const params: any[] = [];
    let index = 1;

    if (status) {
      conditions.push(`status = $${index++}`);
      params.push(status);
    }

    if (deviceId) {
      conditions.push(`device_id = $${index++}`);
      params.push(deviceId);
    }

    if (metricName) {
      conditions.push(`metric_name = $${index++}`);
      params.push(metricName);
    }

    if (from) {
      conditions.push(`triggered_at >= $${index++}`);
      params.push(from.toISOString());
    }

    if (to) {
      conditions.push(`triggered_at <= $${index++}`);
      params.push(to.toISOString());
    }

    let query = `
      SELECT id, device_id, metric_name, rule_id, value, status, triggered_at, resolved_at
      FROM alerts
    `;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY triggered_at DESC";

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.mapRowToAlert(row));
  }

  async findByStatus(status?: AlertStatus): Promise<Alert[]> {
    // Backwards-compatible wrapper used by legacy code/tests.
    return this.findByCriteria({ status });
  }

  async resolveAlert(
    id: string,
    resolvedAt: Date = new Date(),
  ): Promise<Alert | null> {
    const result = await this.pool.query(
      `
      UPDATE alerts
      SET status = 'RESOLVED',
          resolved_at = $2
      WHERE id = $1
      RETURNING id, device_id, metric_name, rule_id, value, status, triggered_at, resolved_at
      `,
      [id, resolvedAt.toISOString()],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAlert(result.rows[0]);
  }
}
