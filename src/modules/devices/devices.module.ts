import { Module } from "@nestjs/common";
import { DevicesRepository } from "./devices.repository";
import { DevicesController } from "./devices.controller";

@Module({
  controllers: [DevicesController],
  providers: [DevicesRepository],
  exports: [DevicesRepository],
})
export class DevicesModule {}
