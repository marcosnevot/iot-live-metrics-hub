import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
