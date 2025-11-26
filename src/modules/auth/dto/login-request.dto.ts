import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, MaxLength } from "class-validator";

export class LoginRequestDto {
  @ApiProperty({
    description: "Username of the human user.",
    example: "admin@local.test",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @ApiProperty({
    description: "Password of the human user.",
    example: "replace-with-admin-password",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  password!: string;
}
