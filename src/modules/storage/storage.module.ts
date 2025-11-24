import { Module } from "@nestjs/common";
import { TimeseriesStorageService } from "./timeseries-storage.service";
import { RulesModule } from "../rules/rules.module";

@Module({
  imports: [RulesModule],
  providers: [TimeseriesStorageService],
  exports: [TimeseriesStorageService],
})
export class StorageModule {}
