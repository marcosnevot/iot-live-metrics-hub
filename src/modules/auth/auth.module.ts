import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { ApiKeyService } from "./api-key.service";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { ApiKeyAuthGuard } from "./guards/api-key-auth.guard";
import { DevicesModule } from "../devices/devices.module";

const jwtSecret = process.env.JWT_SECRET || "replace-with-local-jwt-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1h";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: jwtExpiresIn as any,
      },
    }),
    DevicesModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ApiKeyService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    ApiKeyAuthGuard,
  ],
  exports: [
    AuthService,
    ApiKeyService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    ApiKeyAuthGuard,
  ],
})
export class AuthModule {}
