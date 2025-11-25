import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export type UserRole = "admin" | "analyst";

export interface AuthenticatedUser {
  username: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwtService: JwtService) {}

  private validateCredentials(
    username: string,
    password: string,
  ): AuthenticatedUser | null {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const analystUsername = process.env.ANALYST_USERNAME;
    const analystPassword = process.env.ANALYST_PASSWORD;

    if (username === adminUsername && password === adminPassword) {
      return { username, role: "admin" };
    }

    if (username === analystUsername && password === analystPassword) {
      return { username, role: "analyst" };
    }

    return null;
  }

  async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = this.validateCredentials(username, password);

    if (!user) {
      this.logger.warn({
        module: "auth",
        operation: "login",
        username,
        status: "failure",
        reason: "invalid_credentials",
      });

      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = {
      sub: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    this.logger.log({
      module: "auth",
      operation: "login",
      username: user.username,
      role: user.role,
      status: "success",
    });

    return { accessToken };
  }
}
