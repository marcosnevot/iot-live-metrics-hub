import { Inject, Injectable, Logger } from "@nestjs/common";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { Rule, RuleType } from "./rule.entity";

export const RULES_PG_POOL = "RULES_PG_POOL";

@Injectable()
export class RulesRepository {
  private readonly logger = new Logger(RulesRepository.name);

  constructor(@Inject(RULES_PG_POOL) private readonly pool: Pool) {}

  private mapRowToRule(row: any): Rule {
    return {
      id: row.id,
      deviceId: row.device_id,
      metricName: row.metric_name,
      ruleType: row.rule_type as RuleType,
      minValue: row.min_value !== null ? Number(row.min_value) : null,
      maxValue: row.max_value !== null ? Number(row.max_value) : null,
      enabled: Boolean(row.enabled),
      createdAt: new Date(row.created_at),
    };
  }

  async findActiveByDeviceAndMetric(
    deviceId: string,
    metricName: string,
  ): Promise<Rule[]> {
    const result = await this.pool.query(
      `
      SELECT id, device_id, metric_name, rule_type, min_value, max_value, enabled, created_at
      FROM rules
      WHERE device_id = $1
        AND metric_name = $2
        AND enabled = TRUE
      ORDER BY created_at ASC
      `,
      [deviceId, metricName],
    );

    return result.rows.map((row) => this.mapRowToRule(row));
  }

  async findByDevice(deviceId: string): Promise<Rule[]> {
    const result = await this.pool.query(
      `
      SELECT id, device_id, metric_name, rule_type, min_value, max_value, enabled, created_at
      FROM rules
      WHERE device_id = $1
      ORDER BY created_at ASC
      `,
      [deviceId],
    );

    return result.rows.map((row) => this.mapRowToRule(row));
  }

  async createRule(params: {
    deviceId: string;
    metricName: string;
    ruleType: RuleType;
    minValue?: number | null;
    maxValue?: number | null;
    enabled?: boolean;
  }): Promise<Rule> {
    const {
      deviceId,
      metricName,
      ruleType,
      minValue = null,
      maxValue = null,
      enabled = true,
    } = params;

    const id = randomUUID();

    const result = await this.pool.query(
      `
      INSERT INTO rules (
        id,
        device_id,
        metric_name,
        rule_type,
        min_value,
        max_value,
        enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, device_id, metric_name, rule_type, min_value, max_value, enabled, created_at
      `,
      [id, deviceId, metricName, ruleType, minValue, maxValue, enabled],
    );

    return this.mapRowToRule(result.rows[0]);
  }
}
