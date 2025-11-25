import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AlertsRepository } from "./alerts.repository";
import { Alert, AlertStatus } from "./alert.entity";
import { AlertResponseDto } from "./dto/alert-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { GetAlertsQueryDto } from "./dto/get-alerts-query.dto";

@ApiTags("alerts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles("admin", "analyst")
  async getAlerts(@Query() query: GetAlertsQueryDto): Promise<Alert[]> {
    const { status, device_id, metric_name, from, to } = query;

    const normalizedDeviceId =
      device_id && device_id.trim().length > 0 ? device_id.trim() : undefined;

    const normalizedMetricName =
      metric_name && metric_name.trim().length > 0
        ? metric_name.trim()
        : undefined;

    let parsedFrom: Date | undefined;
    let parsedTo: Date | undefined;

    if (from !== undefined) {
      parsedFrom = new Date(from);
    }

    if (to !== undefined) {
      parsedTo = new Date(to);
    }

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      throw new BadRequestException(
        '"from" must be earlier than or equal to "to".',
      );
    }

    return this.alertsRepository.findByCriteria({
      status,
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
  @Roles("admin")
  async resolveAlert(@Param("id") id: string): Promise<Alert> {
    const updated = await this.alertsRepository.resolveAlert(id);

    if (!updated) {
      throw new NotFoundException(`Alert with id ${id} not found`);
    }

    return updated;
  }
}
