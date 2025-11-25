import { Injectable, Logger } from "@nestjs/common";
import { IngestRequestDto } from "./dto/ingest-request.dto";
import {
  TimeseriesReading,
  TimeseriesStorageService,
} from "../storage/timeseries-storage.service";

type IngestContext = {
  channel?: "http" | "mqtt";
};

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(private readonly storage: TimeseriesStorageService) {}

  async ingest(
    request: IngestRequestDto,
    context?: IngestContext,
  ): Promise<number> {
    const now = new Date();
    const channel = context?.channel ?? "http";

    const readings: TimeseriesReading[] = request.metrics.map((metric) => {
      const ts = metric.ts ? new Date(metric.ts) : now;

      return {
        deviceId: request.device_id,
        metricName: metric.name.toLowerCase(),
        ts,
        value: metric.value,
      };
    });

    this.logger.debug({
      module: "ingest",
      operation: "store_metrics",
      channel,
      deviceId: request.device_id,
      metricsCount: readings.length,
      status: "processing",
    });

    try {
      await this.storage.insertReadings(readings);
    } catch (error) {
      this.logger.error({
        module: "ingest",
        operation: "store_metrics",
        channel,
        deviceId: request.device_id,
        metricsCount: readings.length,
        status: "error",
        reason: (error as Error).message,
      });
      throw error;
    }

    this.logger.log({
      module: "ingest",
      operation: "store_metrics",
      channel,
      deviceId: request.device_id,
      metricsCount: readings.length,
      status: "success",
    });

    return readings.length;
  }
}
