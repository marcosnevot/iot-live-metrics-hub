import { AlertsRepository } from "./alerts.repository";
import { AlertStatus } from "./alert.entity";

describe("AlertsRepository", () => {
  let pool: { query: jest.Mock };
  let repository: AlertsRepository;

  beforeEach(() => {
    pool = {
      query: jest.fn(),
    };

    repository = new AlertsRepository(pool as any);
  });

  it("createAlert should map returned row to Alert entity", async () => {
    const row = {
      id: "alert-1",
      device_id: "device-1",
      metric_name: "temperature",
      rule_id: "rule-1",
      value: "42.5",
      status: "ACTIVE",
      triggered_at: "2025-11-24T10:00:00.000Z",
      resolved_at: null,
    };

    pool.query.mockResolvedValue({ rows: [row] });

    const result = await repository.createAlert({
      deviceId: "device-1",
      metricName: "temperature",
      ruleId: "rule-1",
      value: 42.5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      id: "alert-1",
      deviceId: "device-1",
      metricName: "temperature",
      ruleId: "rule-1",
      value: 42.5,
      status: AlertStatus.ACTIVE,
      triggeredAt: new Date("2025-11-24T10:00:00.000Z"),
      resolvedAt: null,
    });
  });

  it("findByCriteria should map rows to Alert entities", async () => {
    const row = {
      id: "alert-1",
      device_id: "device-1",
      metric_name: "temperature",
      rule_id: "rule-1",
      value: "10",
      status: "RESOLVED",
      triggered_at: "2025-11-24T10:00:00.000Z",
      resolved_at: "2025-11-24T11:00:00.000Z",
    };

    pool.query.mockResolvedValue({ rows: [row] });

    const result = await repository.findByCriteria({
      status: AlertStatus.RESOLVED,
      deviceId: "device-1",
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(result).toEqual([
      {
        id: "alert-1",
        deviceId: "device-1",
        metricName: "temperature",
        ruleId: "rule-1",
        value: 10,
        status: AlertStatus.RESOLVED,
        triggeredAt: new Date("2025-11-24T10:00:00.000Z"),
        resolvedAt: new Date("2025-11-24T11:00:00.000Z"),
      },
    ]);
  });

  it("resolveAlert should return null when no rows are updated", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await repository.resolveAlert("missing-id");

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});
