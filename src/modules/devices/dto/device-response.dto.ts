import { ApiProperty } from "@nestjs/swagger";

export class DeviceResponseDto {
  @ApiProperty({
    description: "Device unique identifier",
    format: "uuid",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  id!: string;

  @ApiProperty({
    description: "Human readable device name",
    example: "Freezer A",
  })
  name!: string;

  @ApiProperty({
    description: "Whether the device is active",
    example: true,
  })
  active!: boolean;

  @ApiProperty({
    description: "Creation timestamp",
    type: String,
    format: "date-time",
    example: "2025-11-24T22:34:45.758Z",
  })
  created_at!: string;

  @ApiProperty({
    description: "Last update timestamp",
    type: String,
    format: "date-time",
    example: "2025-11-24T22:34:45.758Z",
  })
  updated_at!: string;
}

export class DeviceCreatedResponseDto extends DeviceResponseDto {
  @ApiProperty({
    description: "Generated API key for this device. Returned only on creation.",
    example: "a38f3c9e9d7c0e3f9b1c0f24f8e0f7c9f0d2b3e6a9c4d7f8b1c0a9e5f2d3c4",
  })
  api_key!: string;
}
