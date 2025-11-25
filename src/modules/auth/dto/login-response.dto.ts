import { ApiProperty } from "@nestjs/swagger";

export class LoginResponseDto {
  @ApiProperty({
    description: "JWT access token to be used as Bearer token.",
  })
  accessToken!: string;
}
