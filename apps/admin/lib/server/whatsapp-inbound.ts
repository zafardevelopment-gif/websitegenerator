import "server-only";

import { createHmac } from "node:crypto";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

/**
 * Shared secret n8n signs its POST body with. Env var wins (matches the
 * Razorpay pattern) so ops can rotate without touching the DB; falls back
 * to the encrypted setting configured in Settings → API Keys.
 */
export async function getInboundWebhookSecret(): Promise<string | null> {
  const db = createAdminSupabase();
  return (
    process.env.WHATSAPP_INBOUND_WEBHOOK_SECRET?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.whatsappInboundWebhookSecret).catch(() => null))
  );
}

/** Constant-time HMAC-SHA256 compare — same scheme as the Razorpay webhook. */
export function verifyInboundSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
