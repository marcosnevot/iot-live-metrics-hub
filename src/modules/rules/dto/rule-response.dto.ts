// src/modules/rules/dto/rule-response.dto.ts

import { ApiProperty } from "@nestjs/swagger";
import { RuleType } from "../rule.entity";

export class RuleResponseDto {
  @ApiProperty({
    description: "Rule unique identifier.",
    format: "uuid",
    example: "f9e71922-4bb0-4d2f-96e2-908ca1f548c2",
  })
  id!: string;

  @ApiProperty({
    description: "Device identifier the rule is associated with.",
    format: "uuid",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  deviceId!: string;

  @ApiProperty({
    description: "Metric name the rule will evaluate.",
    example: "temperature",
  })
  metricName!: string;

  @ApiProperty({
    description: "Type of rule.",
    enum: RuleType,
    example: RuleType.RANGE,
  })
  ruleType!: RuleType;

  @ApiProperty({
    description: "Minimum value threshold for the rule, if applicable.",
    nullable: true,
    example: -5,
  })
  minValue!: number | null;

  @ApiProperty({
    description: "Maximum value threshold for the rule, if applicable.",
    nullable: true,
    example: 2,
  })
  maxValue!: number | null;

  @ApiProperty({
    description: "Whether the rule is currently enabled.",
    example: true,
  })
  enabled!: boolean;

  @ApiProperty({
    description: "Creation timestamp.",
    type: String,
    format: "date-time",
    example: "2025-11-24T22:34:45.758Z",
  })
  createdAt!: Date;
}
