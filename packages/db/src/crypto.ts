import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for API keys stored in `aiwebsite_settings`.
 * Format: `enc:v1:<iv b64>:<auth tag b64>:<ciphertext b64>` — versioned so the
 * scheme can be rotated later without breaking stored values.
 */

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY is not set. Generate one with " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" ` +
        "and add it to apps/admin/.env.local."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64).");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":")
  );
}

export function decryptSecret(token: string): string {
  if (!token.startsWith(PREFIX)) {
    throw new Error("Value is not an enc:v1 encrypted secret.");
  }
  const [ivB64, tagB64, dataB64] = token.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
