import { Test, TestingModule } from "@nestjs/testing";
import { IngestService } from "./ingest.service";
import {
  TimeseriesStorageService,
  TimeseriesReading,
} from "../storage/timeseries-storage.service";
import { IngestRequestDto } from "./dto/ingest-request.dto";
import { ObservabilityService } from "../observability/metrics.service";

describe("IngestService", () => {
  let service: IngestService;
  let storage: TimeseriesStorageService;
  let observability: ObservabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestService,
        {
          provide: TimeseriesStorageService,
          useValue: {
            insertReadings: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ObservabilityService,
          useValue: {
            incrementIngestTotal: jest.fn(),
            observeDbWriteLatency: jest.fn(),
            observeProcessingLatency: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IngestService>(IngestService);
    storage = module.get<TimeseriesStorageService>(TimeseriesStorageService);
    observability = module.get<ObservabilityService>(ObservabilityService);
  });

  it("debería persistir todas las métricas y devolver el número", async () => {
    const request: IngestRequestDto = {
      device_id: "550e8400-e29b-41d4-a716-446655440000",
      metrics: [
        { name: "Temperature", value: 27.5, ts: "2025-01-01T12:00:00Z" },
        { name: "humidity", value: 40.1 },
      ],
    };

    const result = await service.ingest(request);

    expect(result).toBe(2);
    expect(storage.insertReadings).toHaveBeenCalledTimes(1);

    const arg = (storage.insertReadings as jest.Mock).mock
      .calls[0][0] as TimeseriesReading[];

    expect(arg).toHaveLength(2);
    expect(arg[0]).toMatchObject({
      deviceId: request.device_id,
      metricName: "temperature",
      value: 27.5,
    });
    expect(arg[1]).toMatchObject({
      deviceId: request.device_id,
      metricName: "humidity",
      value: 40.1,
    });

    // Optional: verify observability call on success
    expect(
      (observability.incrementIngestTotal as jest.Mock).mock.calls,
    ).toContainEqual(["http", "success"]);
  });

  it("debería propagar el error si falla el almacenamiento", async () => {
    (storage.insertReadings as jest.Mock).mockRejectedValueOnce(
      new Error("db down"),
    );

    const request: IngestRequestDto = {
      device_id: "550e8400-e29b-41d4-a716-446655440000",
      metrics: [{ name: "temperature", value: 27.5 }],
    };

    await expect(service.ingest(request)).rejects.toThrow("db down");

    // Optional: verify observability call on error
    expect(
      (observability.incrementIngestTotal as jest.Mock).mock.calls,
    ).toContainEqual(["http", "error"]);
  });
});
