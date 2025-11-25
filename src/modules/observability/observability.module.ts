import { Module } from "@nestjs/common";
import { ObservabilityService } from "./metrics.service";
import { ObservabilityMetricsController } from "./metrics.controller";
import { HttpMetricsInterceptor } from "./http-metrics.interceptor";

@Module({
  providers: [ObservabilityService, HttpMetricsInterceptor],
  controllers: [ObservabilityMetricsController],
  exports: [ObservabilityService, HttpMetricsInterceptor],
})
export class ObservabilityModule {}
