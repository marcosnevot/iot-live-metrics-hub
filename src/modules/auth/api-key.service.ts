import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiKeyService {
  validateDeviceApiKey(
    apiKey: string | undefined | null,
  ): { deviceId: string } | null {
    if (!apiKey) {
      return null;
    }

    const expected = process.env.INGEST_API_KEY;

    const effectiveExpected = expected || "dev-api-key-change-me";

    if (apiKey !== effectiveExpected) {
      return null;
    }

    return { deviceId: "dev-device-placeholder" };
  }
}
