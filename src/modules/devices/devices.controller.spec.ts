import { Test, TestingModule } from "@nestjs/testing";
import { DevicesController } from "./devices.controller";
import { DevicesRepository } from "./devices.repository";

describe("DevicesController", () => {
  let controller: DevicesController;
  let devicesRepository: { findAll: jest.Mock; createDevice: jest.Mock };

  beforeEach(async () => {
    devicesRepository = {
      findAll: jest.fn(),
      createDevice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        {
          provide: DevicesRepository,
          useValue: devicesRepository,
        },
      ],
    }).compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should list devices and map entities to response DTOs", async () => {
    const createdAt = new Date("2024-01-01T10:00:00.000Z");
    const updatedAt = new Date("2024-01-02T12:00:00.000Z");

    devicesRepository.findAll.mockResolvedValue([
      {
        id: "device-1",
        name: "Temperature sensor",
        active: true,
        createdAt,
        updatedAt,
      } as any,
    ]);

    const result = await controller.listDevices();

    expect(devicesRepository.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: "device-1",
        name: "Temperature sensor",
        active: true,
        created_at: createdAt.toISOString(),
        updated_at: updatedAt.toISOString(),
      },
    ]);
  });

  it("should create device and map entity + api key to response DTO", async () => {
    const createdAt = new Date("2024-01-03T08:00:00.000Z");
    const updatedAt = new Date("2024-01-03T08:05:00.000Z");

    devicesRepository.createDevice.mockResolvedValue({
      device: {
        id: "device-2",
        name: "Pressure sensor",
        active: false,
        createdAt,
        updatedAt,
      } as any,
      apiKeyPlain: "plain-api-key",
    });

    const result = await controller.createDevice({ name: "Pressure sensor" });

    expect(devicesRepository.createDevice).toHaveBeenCalledTimes(1);
    expect(devicesRepository.createDevice).toHaveBeenCalledWith(
      "Pressure sensor",
    );

    expect(result).toEqual({
      id: "device-2",
      name: "Pressure sensor",
      api_key: "plain-api-key",
      active: false,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
    });
  });
});
