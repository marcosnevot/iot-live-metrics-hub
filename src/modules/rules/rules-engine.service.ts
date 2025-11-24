import { Injectable, Logger } from "@nestjs/common";
import { RulesRepository } from "./rules.repository";
import { Rule, RuleType } from "./rule.entity";
import { AlertsRepository } from "../alerts/alerts.repository";

export interface MetricEvaluationContext {
  deviceId: string;
  metricName: string;
  value: number;
}

/**
 * Pure function to decide whether a rule should trigger for a given value.
 * This is intentionally side-effect free to simplify unit testing.
 */
export function shouldTriggerRule(rule: Rule, value: number): boolean {
  switch (rule.ruleType) {
    case RuleType.MAX: {
      if (rule.maxValue === null || rule.maxValue === undefined) {
        return false;
      }
      return value > rule.maxValue;
    }

    case RuleType.MIN: {
      if (rule.minValue === null || rule.minValue === undefined) {
        return false;
      }
      return value < rule.minValue;
    }

    case RuleType.RANGE: {
      if (
        rule.minValue === null ||
        rule.minValue === undefined ||
        rule.maxValue === null ||
        rule.maxValue === undefined
      ) {
        return false;
      }
      return value < rule.minValue || value > rule.maxValue;
    }

    default:
      return false;
  }
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    private readonly rulesRepository: RulesRepository,
    private readonly alertsRepository: AlertsRepository,
  ) {}

  /**
   * Main entry point for rule evaluation.
   * This method is expected to be called for each new metric reading.
   */
  async evaluateForMetric(context: MetricEvaluationContext): Promise<void> {
    const { deviceId, metricName, value } = context;

    // Fetch active rules for this device and metric
    const rules = await this.rulesRepository.findActiveByDeviceAndMetric(
      deviceId,
      metricName,
    );

    if (rules.length === 0) {
      return;
    }

    const triggeredRules: Rule[] = [];

    for (const rule of rules) {
      const triggered = shouldTriggerRule(rule, value);

      if (triggered) {
        triggeredRules.push(rule);
      }
    }

    if (triggeredRules.length === 0) {
      return;
    }

    // Persist alerts for all triggered rules
    const createAlertPromises = triggeredRules.map((rule) =>
      this.alertsRepository
        .createAlert({
          deviceId,
          metricName,
          ruleId: rule.id,
          value,
        })
        .then((alert) => {
          this.logger.warn({
            msg: "Rule triggered, alert created",
            deviceId,
            metricName,
            ruleId: rule.id,
            alertId: alert.id,
            value,
            ruleType: rule.ruleType,
          });
        })
        .catch((error) => {
          this.logger.error(
            {
              msg: "Failed to create alert for triggered rule",
              deviceId,
              metricName,
              ruleId: rule.id,
              value,
              ruleType: rule.ruleType,
            },
            error.stack,
          );
        }),
    );

    await Promise.all(createAlertPromises);
  }
}
