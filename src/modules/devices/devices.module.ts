import { Module } from '@nestjs/common';
import { DevicesRepository } from './devices.repository';

@Module({
  providers: [DevicesRepository],
  exports: [DevicesRepository],
})
export class DevicesModule {}