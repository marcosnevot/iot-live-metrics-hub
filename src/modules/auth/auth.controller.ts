import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginRequestDto } from "./dto/login-request.dto";
import { LoginResponseDto } from "./dto/login-response.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    const { username, password } = body;
    const result = await this.authService.login(username, password);

    return { accessToken: result.accessToken };
  }
}
