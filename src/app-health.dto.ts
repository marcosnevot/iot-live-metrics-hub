import { ApiProperty } from "@nestjs/swagger";

export class HealthResponseDto {
  @ApiProperty({
    description: "Overall service status.",
    example: "ok",
  })
  status!: string;

  @ApiProperty({
    description: "Service identifier.",
    example: "iot-live-metrics-hub-api",
  })
  service!: string;

  @ApiProperty({
    description: "Timestamp in ISO-8601 format.",
    type: String,
    format: "date-time",
    example: "2025-11-24T22:34:45.758Z",
  })
  timestamp!: string;
}
