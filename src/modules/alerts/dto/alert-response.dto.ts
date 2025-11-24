import { ApiProperty } from "@nestjs/swagger";
import { AlertStatus } from "../alert.entity";

export class AlertResponseDto {
  @ApiProperty({
    description: "Alert unique identifier",
    format: "uuid",
    example: "d1b3f2a4-5c67-8901-2345-6789abcdef01",
  })
  id!: string;

  @ApiProperty({
    description: "Device identifier associated with the alert",
    format: "uuid",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  deviceId!: string;

  @ApiProperty({
    description: "Metric name that triggered the alert",
    example: "temperature",
  })
  metricName!: string;

  @ApiProperty({
    description: "Rule identifier that generated the alert",
    format: "uuid",
    example: "f9e71922-4bb0-4d2f-96e2-908ca1f548c2",
  })
  ruleId!: string;

  @ApiProperty({
    description: "Metric value that triggered the alert",
    example: 12.34,
  })
  value!: number;

  @ApiProperty({
    description: "Current status of the alert",
    enum: AlertStatus,
    example: AlertStatus.ACTIVE,
  })
  status!: AlertStatus;

  @ApiProperty({
    description: "When the alert was triggered",
    type: String,
    format: "date-time",
    example: "2025-11-24T22:34:45.758Z",
  })
  triggeredAt!: Date;

  @ApiProperty({
    description: "When the alert was resolved, if resolved",
    type: String,
    format: "date-time",
    nullable: true,
    example: null,
  })
  resolvedAt!: Date | null;
}
