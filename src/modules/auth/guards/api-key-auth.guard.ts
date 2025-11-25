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

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const deviceIdFromBody =
      (request.body && (request.body as any).device_id) || undefined;

    if (!deviceIdFromBody || typeof deviceIdFromBody !== "string") {
      throw new UnauthorizedException(
        "Missing or invalid device_id in request body",
      );
    }

    const result = await this.apiKeyService.validateDeviceApiKey(
      token,
      deviceIdFromBody,
    );

    if (!result) {
      throw new UnauthorizedException("Invalid API key or device");
    }

    // Device context for downstream logging / auditing if needed.
    (request as any).device = {
      id: result.deviceId,
    };

    return true;
  }
}
