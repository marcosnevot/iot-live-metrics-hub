import { Module } from "@nestjs/common";
import { TimeseriesStorageService } from "./timeseries-storage.service";

@Module({
  imports: [],
  providers: [TimeseriesStorageService],
  exports: [TimeseriesStorageService],
})
export class StorageModule {}
