import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsISO8601,
} from "class-validator";
import { AlertStatus } from "../alert.entity";

export class GetAlertsQueryDto {
  @ApiPropertyOptional({
    description: "Filter by alert status.",
    enum: AlertStatus,
    example: AlertStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AlertStatus, {
    message: "status must be one of: ACTIVE, RESOLVED",
  })
  status?: AlertStatus;

  @ApiPropertyOptional({
    description: "Filter by device identifier (UUID).",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  @IsOptional()
  @IsUUID("4", {
    message: "device_id must be a valid UUID v4",
  })
  device_id?: string;

  @ApiPropertyOptional({
    description: "Filter by metric name.",
    example: "temperature",
  })
  @IsOptional()
  @IsString()
  metric_name?: string;

  @ApiPropertyOptional({
    description:
      "Filter alerts triggered at or after this timestamp (ISO-8601).",
    example: "2025-11-24T00:00:00Z",
  })
  @IsOptional()
  @IsISO8601({}, { message: '"from" must be a valid ISO-8601 datetime' })
  from?: string;

  @ApiPropertyOptional({
    description:
      "Filter alerts triggered at or before this timestamp (ISO-8601).",
    example: "2025-11-25T00:00:00Z",
  })
  @IsOptional()
  @IsISO8601({}, { message: '"to" must be a valid ISO-8601 datetime' })
  to?: string;
}
