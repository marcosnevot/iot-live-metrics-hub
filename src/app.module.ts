import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

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
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || "info",
        // En local, logs “bonitos”; en producción, JSON crudo.
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: "SYS:standard",
                },
              }
            : undefined,
      },
    }),
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
