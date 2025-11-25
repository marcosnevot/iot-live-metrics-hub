import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";

@ApiTags("devices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("devices")
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name);

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
  @Roles("admin", "analyst")
  async listDevices(): Promise<DeviceResponseDto[]> {
    this.logger.log({
      module: "devices",
      operation: "list_devices",
      status: "requested",
    });

    const devices = await this.devicesRepository.findAll();

    this.logger.log({
      module: "devices",
      operation: "list_devices",
      status: "success",
      devicesCount: devices.length,
    });

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
      "Creates a new device and returns its identifier and API key. The API key is only returned once at creation time.",
  })
  @ApiCreatedResponse({
    description: "Device successfully created.",
    type: DeviceCreatedResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid request body.",
  })
  @Roles("admin")
  async createDevice(
    @Body() dto: CreateDeviceDto,
  ): Promise<DeviceCreatedResponseDto> {
    this.logger.log({
      module: "devices",
      operation: "create_device",
      name: dto.name,
      status: "requested",
    });

    const { device, apiKeyPlain } = await this.devicesRepository.createDevice(
      dto.name,
    );

    this.logger.log({
      module: "devices",
      operation: "create_device",
      deviceId: device.id,
      name: device.name,
      active: device.active,
      status: "success",
    });

    return {
      id: device.id,
      name: device.name,
      api_key: apiKeyPlain,
      active: device.active,
      created_at: device.createdAt.toISOString(),
      updated_at: device.updatedAt.toISOString(),
    };
  }
}
