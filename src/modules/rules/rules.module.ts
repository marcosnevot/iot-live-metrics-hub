import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { RULES_PG_POOL, RulesRepository } from "./rules.repository";
import { AlertsModule } from "../alerts/alerts.module";
import { RulesEngineService } from "./rules-engine.service";
import { RulesController } from "./rules.controller";
import { ObservabilityModule } from "../observability/observability.module";

@Module({
  imports: [AlertsModule, ObservabilityModule],
  controllers: [RulesController],
  providers: [
    {
      provide: RULES_PG_POOL,
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
    RulesRepository,
    RulesEngineService,
  ],
  exports: [RulesRepository, RulesEngineService],
})
export class RulesModule {}
