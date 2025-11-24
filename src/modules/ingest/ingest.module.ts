import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { MqttIngestListener } from "./mqtt-ingest.listener";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [IngestController],
  providers: [IngestService, MqttIngestListener],
  exports: [IngestService],
})
export class IngestModule {}
