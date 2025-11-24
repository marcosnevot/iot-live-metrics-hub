import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { ApiKeyService } from "../api-key.service";

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader =
      request.headers["authorization"] || request.headers["Authorization"];

    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedException("Missing Authorization header");
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Invalid Authorization format");
    }

    const result = this.apiKeyService.validateDeviceApiKey(token);

    if (!result) {
      throw new UnauthorizedException("Invalid API key");
    }

    // Guardamos el contexto del dispositivo para uso futuro (reglas, auditoría, etc.)
    (request as any).device = {
      id: result.deviceId,
    };

    return true;
  }
}
