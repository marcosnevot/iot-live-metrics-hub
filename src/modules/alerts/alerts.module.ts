import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { ALERTS_PG_POOL, AlertsRepository } from "./alerts.repository";
import { AlertsController } from "./alerts.controller";

@Module({
  controllers: [AlertsController],
  providers: [
    {
      provide: ALERTS_PG_POOL,
      useFactory: () => {
        const connectionString =
          process.env.DATABASE_URL ??
          "postgresql://postgres:admin@localhost:5432/postgres";

        return new Pool({
          connectionString,
          max: 10,
        });
      },
    },
    AlertsRepository,
  ],
  exports: [AlertsRepository],
})
export class AlertsModule {}
