import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { ObservabilityService } from "./metrics.service";

/**
 * Technical endpoint for Prometheus scraping.
 * It is excluded from the public Swagger documentation.
 */
@ApiExcludeController()
@Controller()
export class ObservabilityMetricsController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    return this.observabilityService.getMetricsAsText();
  }
}
