import { Body, Controller, Logger, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginRequestDto } from "./dto/login-request.dto";
import { LoginResponseDto } from "./dto/login-response.dto";

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    const { username, password } = body;

    this.logger.log({
      module: "auth",
      operation: "login",
      username,
      status: "requested",
    });

    const result = await this.authService.login(username, password);

    // Success is logged in AuthService to centralize auth logging

    return { accessToken: result.accessToken };
  }
}
