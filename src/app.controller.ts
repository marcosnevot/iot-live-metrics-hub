import { Controller, Get } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AppService } from "./app.service";
import { HealthResponseDto } from "./app-health.dto";

@ApiTags("App")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: "Root endpoint",
    description: "Returns a simple welcome message from the API.",
  })
  @ApiOkResponse({
    description: "Welcome message.",
    schema: {
      type: "string",
      example: "IoT Live Metrics Hub API",
    },
  })
  getRoot(): string {
    return this.appService.getRoot();
  }

  @Get("health")
  @ApiOperation({
    summary: "Health check",
    description: "Returns basic health information for the API.",
  })
  @ApiOkResponse({
    description: "Current health status of the API.",
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return {
      status: "ok",
      service: "iot-live-metrics-hub-api",
      timestamp: new Date().toISOString(),
    };
  }
}

