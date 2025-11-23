import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { IngestModule } from "./modules/ingest/ingest.module";
import { StorageModule } from "./modules/storage/storage.module";
import { RulesModule } from "./modules/rules/rules.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    IngestModule,
    StorageModule,
    RulesModule,
    AlertsModule,
    DevicesModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
