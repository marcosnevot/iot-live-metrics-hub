import { RulesEngineService, shouldTriggerRule } from "./rules-engine.service";
import { Rule, RuleType } from "./rule.entity";
import { RulesRepository } from "./rules.repository";
import { AlertsRepository } from "../alerts/alerts.repository";
import { ObservabilityService } from "../observability/metrics.service";

function makeRule(partial: Partial<Rule>): Rule {
  return {
    id: "rule-1",
    deviceId: "device-1",
    metricName: "temperature",
    ruleType: RuleType.MAX,
    minValue: null,
    maxValue: null,
    enabled: true,
    createdAt: new Date(),
    ...partial,
  };
}

describe("shouldTriggerRule", () => {
  describe("MAX rules", () => {
    it("returns true when value is greater than max", () => {
      const rule = makeRule({
        ruleType: RuleType.MAX,
        maxValue: 30,
      });

      expect(shouldTriggerRule(rule, 31)).toBe(true);
    });

    it("returns false when value is equal to max", () => {
      const rule = makeRule({
        ruleType: RuleType.MAX,
        maxValue: 30,
      });

      expect(shouldTriggerRule(rule, 30)).toBe(false);
    });

    it("returns false when value is below max", () => {
      const rule = makeRule({
        ruleType: RuleType.MAX,
        maxValue: 30,
      });

      expect(shouldTriggerRule(rule, 29)).toBe(false);
    });

    it("returns false when maxValue is null", () => {
      const rule = makeRule({
        ruleType: RuleType.MAX,
        maxValue: null,
      });

      expect(shouldTriggerRule(rule, 100)).toBe(false);
    });
  });

  describe("MIN rules", () => {
    it("returns true when value is less than min", () => {
      const rule = makeRule({
        ruleType: RuleType.MIN,
        minValue: 10,
      });

      expect(shouldTriggerRule(rule, 9)).toBe(true);
    });

    it("returns false when value is equal to min", () => {
      const rule = makeRule({
        ruleType: RuleType.MIN,
        minValue: 10,
      });

      expect(shouldTriggerRule(rule, 10)).toBe(false);
    });

    it("returns false when value is greater than min", () => {
      const rule = makeRule({
        ruleType: RuleType.MIN,
        minValue: 10,
      });

      expect(shouldTriggerRule(rule, 11)).toBe(false);
    });

    it("returns false when minValue is null", () => {
      const rule = makeRule({
        ruleType: RuleType.MIN,
        minValue: null,
      });

      expect(shouldTriggerRule(rule, -100)).toBe(false);
    });
  });

  describe("RANGE rules", () => {
    it("returns false when value is inside [min, max]", () => {
      const rule = makeRule({
        ruleType: RuleType.RANGE,
        minValue: 10,
        maxValue: 20,
      });

      expect(shouldTriggerRule(rule, 15)).toBe(false);
      expect(shouldTriggerRule(rule, 10)).toBe(false);
      expect(shouldTriggerRule(rule, 20)).toBe(false);
    });

    it("returns true when value is below min", () => {
      const rule = makeRule({
        ruleType: RuleType.RANGE,
        minValue: 10,
        maxValue: 20,
      });

      expect(shouldTriggerRule(rule, 5)).toBe(true);
    });

    it("returns true when value is above max", () => {
      const rule = makeRule({
        ruleType: RuleType.RANGE,
        minValue: 10,
        maxValue: 20,
      });

      expect(shouldTriggerRule(rule, 25)).toBe(true);
    });

    it("returns false when minValue is null", () => {
      const rule = makeRule({
        ruleType: RuleType.RANGE,
        minValue: null,
        maxValue: 20,
      });

      expect(shouldTriggerRule(rule, 5)).toBe(false);
    });

    it("returns false when maxValue is null", () => {
      const rule = makeRule({
        ruleType: RuleType.RANGE,
        minValue: 10,
        maxValue: null,
      });

      expect(shouldTriggerRule(rule, 25)).toBe(false);
    });
  });
});

describe("RulesEngineService", () => {
  let rulesRepository: RulesRepository;
  let alertsRepository: AlertsRepository;
  let observabilityService: ObservabilityService;
  let service: RulesEngineService;

  let findActiveByDeviceAndMetricMock: jest.Mock;
  let createAlertMock: jest.Mock;
  let incrementAlertTriggeredMock: jest.Mock;

  const deviceId = "device-1";
  const metricName = "temperature";

  beforeEach(() => {
    findActiveByDeviceAndMetricMock = jest.fn();
    createAlertMock = jest.fn();
    incrementAlertTriggeredMock = jest.fn();

    rulesRepository = {
      findActiveByDeviceAndMetric: findActiveByDeviceAndMetricMock,
    } as unknown as RulesRepository;

    alertsRepository = {
      createAlert: createAlertMock,
    } as unknown as AlertsRepository;

    observabilityService = {
      incrementAlertTriggered: incrementAlertTriggeredMock,
    } as unknown as ObservabilityService;

    service = new RulesEngineService(
      rulesRepository,
      alertsRepository,
      observabilityService,
    );
  });

  it("should return early when there are no active rules", async () => {
    findActiveByDeviceAndMetricMock.mockResolvedValue([]);

    await service.evaluateForMetric({
      deviceId,
      metricName,
      value: 42,
    });

    expect(findActiveByDeviceAndMetricMock).toHaveBeenCalledWith(
      deviceId,
      metricName,
    );
    expect(createAlertMock).not.toHaveBeenCalled();
    expect(incrementAlertTriggeredMock).not.toHaveBeenCalled();
  });

  it("should not create alerts when no rule is triggered", async () => {
    const nonTriggeringRule: Rule = makeRule({
      ruleType: RuleType.MAX,
      maxValue: 100,
    });

    findActiveByDeviceAndMetricMock.mockResolvedValue([nonTriggeringRule]);

    await service.evaluateForMetric({
      deviceId,
      metricName,
      value: 50, // below maxValue -> should not trigger
    });

    expect(createAlertMock).not.toHaveBeenCalled();
    expect(incrementAlertTriggeredMock).not.toHaveBeenCalled();
  });

  it("should create an alert and increment metrics for a triggered rule", async () => {
    const value = 80;
    const triggeringRule: Rule = makeRule({
      id: "rule-max-1",
      ruleType: RuleType.MAX,
      maxValue: 50,
    });

    findActiveByDeviceAndMetricMock.mockResolvedValue([triggeringRule]);

    createAlertMock.mockResolvedValue({
      id: "alert-1",
      deviceId,
      metricName,
      ruleId: triggeringRule.id,
      value,
      createdAt: new Date(),
      resolvedAt: null,
    });

    await service.evaluateForMetric({
      deviceId,
      metricName,
      value,
    });

    expect(createAlertMock).toHaveBeenCalledTimes(1);
    expect(createAlertMock).toHaveBeenCalledWith({
      deviceId,
      metricName,
      ruleId: triggeringRule.id,
      value,
    });
    expect(incrementAlertTriggeredMock).toHaveBeenCalledTimes(1);
    expect(incrementAlertTriggeredMock).toHaveBeenCalledWith(
      deviceId,
      metricName,
      triggeringRule.ruleType,
    );
  });

  it("should create alerts and increment metrics for multiple triggered rules", async () => {
    const value = 80;
    const rule1: Rule = makeRule({
      id: "rule-max-1",
      ruleType: RuleType.MAX,
      maxValue: 50,
    });
    const rule2: Rule = makeRule({
      id: "rule-range-1",
      ruleType: RuleType.RANGE,
      minValue: 10,
      maxValue: 60,
    });

    findActiveByDeviceAndMetricMock.mockResolvedValue([rule1, rule2]);

    createAlertMock.mockImplementation(async ({ ruleId }) => ({
      id: `alert-for-${ruleId}`,
      deviceId,
      metricName,
      ruleId,
      value,
      createdAt: new Date(),
      resolvedAt: null,
    }));

    await service.evaluateForMetric({
      deviceId,
      metricName,
      value,
    });

    expect(createAlertMock).toHaveBeenCalledTimes(2);
    expect(incrementAlertTriggeredMock).toHaveBeenCalledTimes(2);
  });

  it("should swallow alert creation errors and still resolve", async () => {
    const value = 80;
    const rule: Rule = makeRule({
      id: "rule-max-1",
      ruleType: RuleType.MAX,
      maxValue: 50,
    });

    findActiveByDeviceAndMetricMock.mockResolvedValue([rule]);
    createAlertMock.mockRejectedValue(
      new Error("db is temporarily unavailable"),
    );

    await expect(
      service.evaluateForMetric({
        deviceId,
        metricName,
        value,
      }),
    ).resolves.toBeUndefined();

    expect(createAlertMock).toHaveBeenCalledTimes(1);
    expect(incrementAlertTriggeredMock).not.toHaveBeenCalled();
  });
});
