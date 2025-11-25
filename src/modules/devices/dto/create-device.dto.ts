import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateDeviceDto {
  @ApiProperty({
    description: "Human readable device name",
    maxLength: 100,
    example: "Freezer A",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
