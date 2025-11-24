import { ApiProperty } from "@nestjs/swagger";

export class MetricPointDto {
  @ApiProperty({
    description: "Timestamp of the metric reading in ISO-8601 format.",
    type: String,
    format: "date-time",
    example: "2025-11-24T22:34:45.758Z",
  })
  ts!: string;

  @ApiProperty({
    description: "Numeric value of the metric at the given timestamp.",
    example: 12.34,
  })
  value!: number;
}

export class MetricsSeriesResponseDto {
  @ApiProperty({
    description: "Device identifier associated with the metric readings.",
    format: "uuid",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  device_id!: string;

  @ApiProperty({
    description: "Metric name being queried.",
    example: "temperature",
  })
  metric_name!: string;

  @ApiProperty({
    description: "Time series points for the requested metric.",
    type: MetricPointDto,
    isArray: true,
  })
  points!: MetricPointDto[];
}
