import { Injectable } from "@nestjs/common";
import { DevicesRepository } from "../devices/devices.repository";
import { hashDeviceApiKey } from "../devices/device-api-key.util";

@Injectable()
export class ApiKeyService {
  constructor(private readonly devicesRepository: DevicesRepository) {}

  /**
   * Validates a device API key bound to a specific device_id.
   * Returns the deviceId when validation succeeds, or null otherwise.
   *
   * Rules:
   * - device_id must exist and be active.
   * - The hashed candidate must match the stored api_key field, OR
   *   for legacy devices the stored value may still be the raw API key.
   */
  async validateDeviceApiKey(
    apiKey: string | undefined | null,
    deviceId: string | undefined | null,
  ): Promise<{ deviceId: string } | null> {
    if (!apiKey || !deviceId) {
      return null;
    }

    const device = await this.devicesRepository.findById(deviceId);

    if (!device) {
      return null;
    }

    if (!device.active) {
      return null;
    }

    const hashedCandidate = hashDeviceApiKey(apiKey);
    const stored = device.apiKeyHash;

    // Primary: hash match (new devices created after F8).
    // Fallback: stored value equals raw API key (legacy devices before F8).
    if (stored !== hashedCandidate && stored !== apiKey) {
      return null;
    }

    return { deviceId: device.id };
  }
}
