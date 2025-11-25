import { createHash } from "crypto";

/**
 * Computes a deterministic hash for a device API key.
 * The goal is to avoid storing the raw API key in the database.
 */
export function hashDeviceApiKey(rawApiKey: string): string {
  return createHash("sha256").update(rawApiKey, "utf8").digest("hex");
}
