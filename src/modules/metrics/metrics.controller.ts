import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { TimeseriesStorageService } from "../storage/timeseries-storage.service";

/**
 * MetricsController exposes read-only time-series queries
 * backed by the metric_readings hypertable.
 *
 * Contract aligned with the Master Report:
 * GET /metrics/{device_id}/{metric_name}?from=&to=
 */
@Controller("metrics")
export class MetricsController {
  constructor(private readonly timeseriesStorage: TimeseriesStorageService) {}

  @Get(":deviceId/:metricName")
  async getMetricsByDeviceAndName(
    @Param("deviceId", new ParseUUIDPipe({ version: "4" })) deviceId: string,
    @Param("metricName") metricName: string,
    @Query("from") fromStr?: string,
    @Query("to") toStr?: string,
  ) {
    if (!fromStr || !toStr) {
      throw new BadRequestException(
        "Query parameters 'from' and 'to' are required",
      );
    }

    const from = new Date(fromStr);
    const to = new Date(toStr);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException(
        "Query parameters 'from' and 'to' must be valid ISO-8601 timestamps",
      );
    }

    if (from > to) {
      throw new BadRequestException(
        "'from' timestamp must be earlier than or equal to 'to' timestamp",
      );
    }

    const readings = await this.timeseriesStorage.getReadingsForDeviceMetric(
      deviceId,
      metricName,
      from,
      to,
    );

    return {
      device_id: deviceId,
      metric_name: metricName,
      points: readings.map((r) => ({
        ts: r.ts.toISOString(),
        value: r.value,
      })),
    };
  }
}
