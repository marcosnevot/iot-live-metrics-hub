import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): string {
    return this.appService.getRoot();
  }

  @Get("health")
  getHealth() {
    return {
      status: "ok",
      service: "iot-live-metrics-hub-api",
      timestamp: new Date().toISOString(),
    };
  }
}
