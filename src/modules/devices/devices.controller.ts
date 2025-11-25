import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { DevicesRepository } from "./devices.repository";
import { CreateDeviceDto } from "./dto/create-device.dto";
import {
  DeviceCreatedResponseDto,
  DeviceResponseDto,
} from "./dto/device-response.dto";
import { Device } from "./device.entity";

@ApiTags("devices")
@Controller("devices")
export class DevicesController {
  constructor(private readonly devicesRepository: DevicesRepository) {}

  @Get()
  @ApiOperation({
    summary: "List devices",
    description: "Returns all registered devices.",
  })
  @ApiOkResponse({
    description: "List of registered devices.",
    type: DeviceResponseDto,
    isArray: true,
  })
  async listDevices() {
    const devices = await this.devicesRepository.findAll();

    return devices.map((device: Device) => ({
      id: device.id,
      name: device.name,
      active: device.active,
      created_at: device.createdAt.toISOString(),
      updated_at: device.updatedAt.toISOString(),
    }));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create device",
    description:
      "Creates a new device and returns its identifier and API key. The API key is only returned on creation.",
  })
  @ApiCreatedResponse({
    description: "Device successfully created.",
    type: DeviceCreatedResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid request body.",
  })
  async createDevice(@Body() dto: CreateDeviceDto) {
    const device = await this.devicesRepository.createDevice(dto.name);

    return {
      id: device.id,
      name: device.name,
      api_key: device.apiKey,
      active: device.active,
      created_at: device.createdAt.toISOString(),
      updated_at: device.updatedAt.toISOString(),
    };
  }
}
