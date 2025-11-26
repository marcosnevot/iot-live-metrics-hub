import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { IngestModule } from "./modules/ingest/ingest.module";
import { StorageModule } from "./modules/storage/storage.module";
import { RulesModule } from "./modules/rules/rules.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { AuthModule } from "./modules/auth/auth.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { ObservabilityModule } from "./modules/observability/observability.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || "info",
        // Redact sensitive data from logs to avoid leaking secrets
        redact: [
          "req.headers.authorization",
          'req.headers["x-api-key"]',
          "req.headers.cookie",
          "req.body.password",
          "req.body.currentPassword",
          "req.body.newPassword",
          "req.body.token",
        ],
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

    // Global rate limiting (basic hardening)
    ThrottlerModule.forRoot([
      {
        // Time window in milliseconds (default 60 seconds)
        ttl: Number(process.env.RATE_LIMIT_TTL_MS || "60000"),
        // Max requests per IP in that window (global default)
        limit: Number(process.env.RATE_LIMIT_LIMIT || "300"),
      },
    ]),

    IngestModule,
    StorageModule,
    RulesModule,
    AlertsModule,
    DevicesModule,
    AuthModule,
    MetricsModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
