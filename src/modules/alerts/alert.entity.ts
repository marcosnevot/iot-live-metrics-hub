export enum AlertStatus {
  ACTIVE = "ACTIVE",
  RESOLVED = "RESOLVED",
}

export interface Alert {
  id: string;
  deviceId: string;
  metricName: string;
  ruleId: string;
  value: number;
  status: AlertStatus;
  triggeredAt: Date;
  resolvedAt: Date | null;
}
