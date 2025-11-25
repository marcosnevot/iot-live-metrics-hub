import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AlertsRepository } from "./alerts.repository";
import { Alert, AlertStatus } from "./alert.entity";
import { AlertResponseDto } from "./dto/alert-response.dto";

@ApiTags("alerts")
@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsRepository: AlertsRepository) {}

  @Get()
  @ApiOperation({
    summary: "List alerts",
    description:
      "Returns alerts filtered by status, device, metric name and time range.",
  })
  @ApiOkResponse({
    description: "List of alerts matching the provided filters.",
    type: AlertResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid status, invalid date format for 'from'/'to' or inconsistent time range.",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: AlertStatus,
    description: "Filter by alert status.",
  })
  @ApiQuery({
    name: "device_id",
    required: false,
    description: "Filter by device identifier (UUID).",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  @ApiQuery({
    name: "metric_name",
    required: false,
    description: "Filter by metric name.",
    example: "temperature",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description:
      "Filter alerts triggered at or after this timestamp (ISO-8601).",
    example: "2025-11-24T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description:
      "Filter alerts triggered at or before this timestamp (ISO-8601).",
    example: "2025-11-25T00:00:00Z",
  })
  async getAlerts(
    @Query("status") status?: string,
    @Query("device_id") deviceId?: string,
    @Query("metric_name") metricName?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<Alert[]> {
    let parsedStatus: AlertStatus | undefined;

    if (status !== undefined) {
      if (status === AlertStatus.ACTIVE || status === AlertStatus.RESOLVED) {
        parsedStatus = status as AlertStatus;
      } else {
        throw new BadRequestException(
          "Invalid status. Allowed values: ACTIVE, RESOLVED",
        );
      }
    }

    const normalizedDeviceId =
      deviceId && deviceId.trim().length > 0 ? deviceId.trim() : undefined;

    const normalizedMetricName =
      metricName && metricName.trim().length > 0
        ? metricName.trim()
        : undefined;

    let parsedFrom: Date | undefined;
    let parsedTo: Date | undefined;

    if (from !== undefined) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException(
          'Invalid "from" parameter. Expected ISO-8601 datetime string.',
        );
      }
      parsedFrom = fromDate;
    }

    if (to !== undefined) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException(
          'Invalid "to" parameter. Expected ISO-8601 datetime string.',
        );
      }
      parsedTo = toDate;
    }

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      throw new BadRequestException(
        '"from" must be earlier than or equal to "to".',
      );
    }

    return this.alertsRepository.findByCriteria({
      status: parsedStatus,
      deviceId: normalizedDeviceId,
      metricName: normalizedMetricName,
      from: parsedFrom,
      to: parsedTo,
    });
  }

  @Patch(":id/resolve")
  @ApiOperation({
    summary: "Resolve alert",
    description: "Marks an alert as RESOLVED.",
  })
  @ApiOkResponse({
    description: "Alert successfully resolved.",
    type: AlertResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Alert with the given id was not found.",
  })
  async resolveAlert(@Param("id") id: string): Promise<Alert> {
    const updated = await this.alertsRepository.resolveAlert(id);

    if (!updated) {
      throw new NotFoundException(`Alert with id ${id} not found`);
    }

    return updated;
  }
}
