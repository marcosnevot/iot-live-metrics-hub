import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RuleType } from "../rule.entity";

export class CreateRuleDto {
  @ApiProperty({
    description: "Device identifier the rule is associated with.",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  @IsString()
  @IsNotEmpty()
  device_id!: string;

  @ApiProperty({
    description: "Metric name the rule will evaluate.",
    example: "temperature",
  })
  @IsString()
  @IsNotEmpty()
  metric_name!: string;

  @ApiProperty({
    description: "Type of rule to apply.",
    enum: RuleType,
    example: RuleType.MAX,
  })
  @IsEnum(RuleType)
  rule_type!: RuleType;

  @ApiPropertyOptional({
    description:
      "Minimum value threshold for the rule, if applicable to the rule type.",
    example: -5,
  })
  @IsOptional()
  @IsNumber()
  min_value?: number;

  @ApiPropertyOptional({
    description:
      "Maximum value threshold for the rule, if applicable to the rule type.",
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  max_value?: number;

  @ApiPropertyOptional({
    description: "Whether the rule is initially enabled.",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
