import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { MqttIngestListener } from "./mqtt-ingest.listener";
import { ObservabilityModule } from "../observability/observability.module";

@Module({
  imports: [AuthModule, StorageModule, ObservabilityModule],
  controllers: [IngestController],
  providers: [IngestService, MqttIngestListener],
  exports: [IngestService],
})
export class IngestModule {}
