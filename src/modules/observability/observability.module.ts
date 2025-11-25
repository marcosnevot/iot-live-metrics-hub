import { Module } from "@nestjs/common";
import { ObservabilityService } from "./metrics.service";
import { ObservabilityMetricsController } from "./metrics.controller";

@Module({
  providers: [ObservabilityService],
  controllers: [ObservabilityMetricsController],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
