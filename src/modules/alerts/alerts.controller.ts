import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import { AlertsRepository } from "./alerts.repository";
import { Alert, AlertStatus } from "./alert.entity";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsRepository: AlertsRepository) {}

  @Get()
  async getAlerts(@Query("status") status?: string): Promise<Alert[]> {
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

    return this.alertsRepository.findByStatus(parsedStatus);
  }

  @Patch(":id/resolve")
  async resolveAlert(@Param("id") id: string): Promise<Alert> {
    const updated = await this.alertsRepository.resolveAlert(id);

    if (!updated) {
      throw new NotFoundException(`Alert with id ${id} not found`);
    }

    return updated;
  }
}
