import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from "class-validator";
import { MetricDto } from "./metric.dto";

export class IngestRequestDto {
  @IsUUID()
  device_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MetricDto)
  metrics: MetricDto[];
}
