import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AlertsController } from "./alerts.controller";
import { AlertsRepository } from "./alerts.repository";
import { AlertStatus } from "./alert.entity";
import { GetAlertsQueryDto } from "./dto/get-alerts-query.dto";

describe("AlertsController", () => {
  let controller: AlertsController;
  let alertsRepository: { findByCriteria: jest.Mock; resolveAlert: jest.Mock };

  beforeEach(async () => {
    alertsRepository = {
      findByCriteria: jest.fn(),
      resolveAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsRepository,
          useValue: alertsRepository,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should throw BadRequestException when 'from' is later than 'to'", async () => {
    const query: GetAlertsQueryDto = {
      status: AlertStatus.ACTIVE,
      device_id: " device-1 ",
      metric_name: " temperature ",
      from: "2025-11-25T00:00:00Z",
      to: "2025-11-24T00:00:00Z",
    };

    await expect(controller.getAlerts(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(alertsRepository.findByCriteria).not.toHaveBeenCalled();
  });

  it("should call repository with normalized filters and parsed dates", async () => {
    const query: GetAlertsQueryDto = {
      status: AlertStatus.ACTIVE,
      device_id: " device-1 ",
      metric_name: " temperature ",
      from: "2025-11-24T00:00:00Z",
      to: "2025-11-25T00:00:00Z",
    };

    const triggeredAt = new Date("2025-11-24T10:00:00.000Z");
    const resolvedAt = null;

    const alert = {
      id: "alert-1",
      deviceId: "device-1",
      metricName: "temperature",
      ruleId: "rule-1",
      value: 42,
      status: AlertStatus.ACTIVE,
      triggeredAt,
      resolvedAt,
    };

    alertsRepository.findByCriteria.mockResolvedValue([alert]);

    const result = await controller.getAlerts(query);

    const expectedFrom = new Date(query.from as string);
    const expectedTo = new Date(query.to as string);

    expect(alertsRepository.findByCriteria).toHaveBeenCalledTimes(1);
    expect(alertsRepository.findByCriteria).toHaveBeenCalledWith({
      status: AlertStatus.ACTIVE,
      deviceId: "device-1",
      metricName: "temperature",
      from: expectedFrom,
      to: expectedTo,
    });

    expect(result).toEqual([alert]);
  });

  it("should call repository with minimal filters when optional fields are empty", async () => {
    const query: GetAlertsQueryDto = {
      status: AlertStatus.RESOLVED,
      device_id: "",
      metric_name: "   ",
      from: undefined,
      to: undefined,
    };

    alertsRepository.findByCriteria.mockResolvedValue([]);

    const result = await controller.getAlerts(query);

    expect(alertsRepository.findByCriteria).toHaveBeenCalledTimes(1);
    expect(alertsRepository.findByCriteria).toHaveBeenCalledWith({
      status: AlertStatus.RESOLVED,
      deviceId: undefined,
      metricName: undefined,
      from: undefined,
      to: undefined,
    });

    expect(result).toEqual([]);
  });

  it("should resolve alert when repository returns an alert", async () => {
    const triggeredAt = new Date("2025-11-24T10:00:00.000Z");
    const resolvedAt = new Date("2025-11-24T11:00:00.000Z");

    const alert = {
      id: "alert-1",
      deviceId: "device-1",
      metricName: "temperature",
      ruleId: "rule-1",
      value: 42,
      status: AlertStatus.RESOLVED,
      triggeredAt,
      resolvedAt,
    };

    alertsRepository.resolveAlert.mockResolvedValue(alert);

    const result = await controller.resolveAlert("alert-1");

    expect(alertsRepository.resolveAlert).toHaveBeenCalledTimes(1);
    expect(alertsRepository.resolveAlert).toHaveBeenCalledWith("alert-1");
    expect(result).toEqual(alert);
  });

  it("should throw NotFoundException when alert to resolve does not exist", async () => {
    alertsRepository.resolveAlert.mockResolvedValue(null);

    await expect(controller.resolveAlert("missing-id")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(alertsRepository.resolveAlert).toHaveBeenCalledTimes(1);
    expect(alertsRepository.resolveAlert).toHaveBeenCalledWith("missing-id");
  });
});
