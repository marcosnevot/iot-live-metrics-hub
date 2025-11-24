export enum RuleType {
  MAX = "MAX",
  MIN = "MIN",
  RANGE = "RANGE",
}

export interface Rule {
  id: string;
  deviceId: string;
  metricName: string;
  ruleType: RuleType;
  minValue: number | null;
  maxValue: number | null;
  enabled: boolean;
  createdAt: Date;
}
