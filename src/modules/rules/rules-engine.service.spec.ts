import { shouldTriggerRule } from "./rules-engine.service";
import { Rule, RuleType } from "./rule.entity";

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
