import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { RuleType } from "../rule.entity";

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  device_id!: string;

  @IsString()
  @IsNotEmpty()
  metric_name!: string;

  @IsEnum(RuleType)
  rule_type!: RuleType;

  @IsOptional()
  @IsNumber()
  min_value?: number;

  @IsOptional()
  @IsNumber()
  max_value?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
