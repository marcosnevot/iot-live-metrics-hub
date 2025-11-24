import { Injectable, Logger } from "@nestjs/common";
import { IngestRequestDto } from "./dto/ingest-request.dto";
import {
  TimeseriesReading,
  TimeseriesStorageService,
} from "../storage/timeseries-storage.service";

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(private readonly storage: TimeseriesStorageService) {}

  async ingest(request: IngestRequestDto): Promise<number> {
    const now = new Date();

    const readings: TimeseriesReading[] = request.metrics.map((metric) => {
      const ts = metric.ts ? new Date(metric.ts) : now;

      return {
        deviceId: request.device_id,
        metricName: metric.name.toLowerCase(),
        ts,
        value: metric.value,
      };
    });

    try {
      await this.storage.insertReadings(readings);
    } catch (error) {
      this.logger.error({
        msg: "ingest_db_error",
        deviceId: request.device_id,
        metricsCount: readings.length,
        error: (error as Error).message,
      });
      throw error;
    }

    this.logger.log({
      msg: "ingest_success",
      deviceId: request.device_id,
      metricsCount: readings.length,
    });

    return readings.length;
  }
}
