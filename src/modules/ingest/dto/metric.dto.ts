import { IsNumber, IsOptional, IsString, IsISO8601 } from "class-validator";

export class MetricDto {
  @IsString()
  name: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsISO8601()
  ts?: string;
}
