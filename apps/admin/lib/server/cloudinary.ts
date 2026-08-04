import "server-only";

import { createHash } from "node:crypto";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Env vars win; encrypted settings are the fallback. Null = not configured. */
export async function getCloudinaryConfig(): Promise<CloudinaryConfig | null> {
  const db = createAdminSupabase();

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.cloudinaryCloudName).catch(() => null));
  const apiKey =
    process.env.CLOUDINARY_API_KEY?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.cloudinaryApiKey).catch(() => null));
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.cloudinaryApiSecret).catch(() => null));

  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

/**
 * Cloudinary API signature: SHA-1 of the alphabetically-sorted params
 * (excluding file/api_key) concatenated with the API secret.
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
}

/**
 * Server-side signed upload from raw bytes (not the browser's signed-ticket
 * flow) — used when the app fetches an image itself (e.g. Google Places
 * photos) and needs to hand Cloudinary the bytes directly.
 */
export async function uploadBufferToCloudinary(
  config: CloudinaryConfig,
  buffer: Buffer,
  contentType: string,
  folder: string
): Promise<CloudinaryUploadResult | null> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinaryParams({ folder, timestamp }, config.apiSecret);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }));
  form.append("folder", folder);
  form.append("timestamp", String(timestamp));
  form.append("api_key", config.apiKey);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    public_id?: string;
    secure_url?: string;
    width?: number;
    height?: number;
    bytes?: number;
    format?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.public_id || !payload.secure_url) return null;

  return {
    publicId: payload.public_id,
    url: payload.secure_url,
    width: payload.width ?? null,
    height: payload.height ?? null,
    bytes: payload.bytes ?? null,
    format: payload.format ?? null,
  };
}

/** Best-effort server-side asset destroy (called on delete). */
export async function destroyCloudinaryAsset(
  config: CloudinaryConfig,
  publicId: string,
  resourceType: "image" | "video" = "image"
): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinaryParams(
    { public_id: publicId, timestamp },
    config.apiSecret
  );
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
  });
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/destroy`,
      { method: "POST", body }
    );
    const payload = (await response.json().catch(() => ({}))) as { result?: string };
    return payload.result === "ok" || payload.result === "not found";
  } catch {
    return false;
  }
}
