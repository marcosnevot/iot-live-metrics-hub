import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { TimeseriesStorageService } from "../storage/timeseries-storage.service";
import { MetricsSeriesResponseDto } from "./dto/metric-series-response.dto";

/**
 * MetricsController exposes read-only time-series queries
 * backed by the metric_readings hypertable.
 *
 * GET /metrics/{device_id}/{metric_name}?from=&to=
 */
@ApiTags("Metrics")
@Controller("metrics")
export class MetricsController {
  constructor(private readonly timeseriesStorage: TimeseriesStorageService) {}

  @Get(":deviceId/:metricName")
  @ApiOperation({
    summary: "Query time-series metrics for a device and metric name",
    description:
      "Returns time-series data points for the given device and metric, within the requested time range.",
  })
  @ApiParam({
    name: "deviceId",
    description: "Device identifier (UUID v4).",
    format: "uuid",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  @ApiParam({
    name: "metricName",
    description: "Metric name to query.",
    example: "temperature",
  })
  @ApiQuery({
    name: "from",
    required: true,
    description: "Start of the time range (inclusive) in ISO-8601 format.",
    example: "2025-11-24T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: true,
    description: "End of the time range (inclusive) in ISO-8601 format.",
    example: "2025-11-25T00:00:00Z",
  })
  @ApiOkResponse({
    description: "Time series points for the requested device and metric.",
    type: MetricsSeriesResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Missing or invalid 'from'/'to' query parameters, invalid UUID or invalid time range.",
  })
  async getMetricsByDeviceAndName(
    @Param("deviceId", new ParseUUIDPipe({ version: "4" })) deviceId: string,
    @Param("metricName") metricName: string,
    @Query("from") fromStr?: string,
    @Query("to") toStr?: string,
  ): Promise<MetricsSeriesResponseDto> {
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
