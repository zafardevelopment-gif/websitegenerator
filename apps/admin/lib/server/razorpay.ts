import "server-only";

import { createHmac } from "node:crypto";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

interface RazorpayCreds {
  keyId: string;
  keySecret: string;
}

async function getRazorpayCreds(): Promise<RazorpayCreds | null> {
  const db = createAdminSupabase();
  const keyId =
    process.env.RAZORPAY_KEY_ID?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.razorpayKeyId).catch(() => null));
  const keySecret =
    process.env.RAZORPAY_KEY_SECRET?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.razorpayKeySecret).catch(() => null));
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export async function getRazorpayWebhookSecret(): Promise<string | null> {
  const db = createAdminSupabase();
  return (
    process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.razorpayWebhookSecret).catch(() => null))
  );
}

export interface CreatePaymentLinkInput {
  amountInr: number;
  description: string;
  referenceId: string;
  customerName: string;
  customerContact?: string | null;
  customerEmail?: string | null;
}

export interface PaymentLinkResult {
  id: string;
  shortUrl: string;
}

/** Creates a Razorpay Payment Link — https://razorpay.com/docs/api/payment-links/ */
export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
  const creds = await getRazorpayCreds();
  if (!creds) {
    throw new Error("Razorpay isn't configured. Add API keys in Settings → API Keys.");
  }

  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(input.amountInr * 100),
      currency: "INR",
      description: input.description,
      reference_id: input.referenceId,
      customer: {
        name: input.customerName,
        contact: input.customerContact ?? undefined,
        email: input.customerEmail ?? undefined,
      },
      notify: { sms: Boolean(input.customerContact), email: Boolean(input.customerEmail) },
      reminder_enable: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    short_url?: string;
    error?: { description?: string };
  };
  if (!response.ok || !payload.id || !payload.short_url) {
    throw new Error(payload.error?.description ?? `Razorpay API HTTP ${response.status}`);
  }
  return { id: payload.id, shortUrl: payload.short_url };
}

/** Verifies the `X-Razorpay-Signature` header per Razorpay's HMAC-SHA256 webhook scheme. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
