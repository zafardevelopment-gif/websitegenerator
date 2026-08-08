import "server-only";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting, getSettingsStatus } from "@aiwebsite/db/settings";

/** Approved template names — see the "Meta WhatsApp Cloud API" section in Settings for the source text. */
export const WHATSAPP_TEMPLATES = {
  /** Business-initiated first contact — Marketing category, requires Meta approval. */
  demoPitch: "demo_pitch_intro",
  /** Sent once a lead replies — Utility category. */
  replyFollowup: "reply_team_followup",
} as const;

interface CloudConfig {
  phoneNumberId: string;
  accessToken: string;
}

async function getCloudConfig(): Promise<CloudConfig | null> {
  const db = createAdminSupabase();
  const [phoneNumberId, accessToken] = await Promise.all([
    getDecryptedSetting(db, SETTING_KEYS.whatsappCloudPhoneNumberId),
    getDecryptedSetting(db, SETTING_KEYS.whatsappCloudAccessToken),
  ]);
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

export async function getWhatsAppCallbackNumber(): Promise<string | null> {
  const db = createAdminSupabase();
  return getDecryptedSetting(db, SETTING_KEYS.whatsappCallbackNumber);
}

/** True once both the phone number ID and access token are saved. */
export async function isWhatsAppCloudConfigured(): Promise<boolean> {
  const db = createAdminSupabase();
  const status = await getSettingsStatus(db, [
    SETTING_KEYS.whatsappCloudPhoneNumberId,
    SETTING_KEYS.whatsappCloudAccessToken,
  ]);
  return (
    (status[SETTING_KEYS.whatsappCloudPhoneNumberId]?.isSet ?? false) &&
    (status[SETTING_KEYS.whatsappCloudAccessToken]?.isSet ?? false)
  );
}

export class WhatsAppCloudError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "WhatsAppCloudError";
  }
}

/** E.164-ish digits only, no leading zero handling beyond the existing normalizer's rules. */
function toWaId(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

interface TemplateParam {
  name?: string;
  value: string;
}

interface SendTemplateInput {
  to: string;
  template: (typeof WHATSAPP_TEMPLATES)[keyof typeof WHATSAPP_TEMPLATES];
  languageCode?: string;
  /** Body variables — use {name, value} objects for named-variable templates ({{name}} syntax). */
  bodyParams: TemplateParam[];
}

interface CloudSendResponse {
  messages?: { id: string }[];
  error?: { message: string; code: number; error_data?: { details?: string } };
}

/** Sends an approved template message via the Meta WhatsApp Cloud API. Returns the provider message id. */
export async function sendWhatsAppTemplate(input: SendTemplateInput): Promise<string> {
  const config = await getCloudConfig();
  if (!config) {
    throw new WhatsAppCloudError(
      "Meta WhatsApp Cloud API isn't configured — add the Phone Number ID and access token in Settings → API Keys."
    );
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: toWaId(input.to),
    type: "template",
    template: {
      name: input.template,
      language: { code: input.languageCode ?? "en" },
      components: [
        {
          type: "body",
          parameters: input.bodyParams.map((p) =>
            p.name
              ? { type: "text", parameter_name: p.name, text: p.value }
              : { type: "text", text: p.value }
          ),
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as CloudSendResponse;

  if (!response.ok || payload.error) {
    const detail = payload.error?.error_data?.details;
    throw new WhatsAppCloudError(
      detail ? `${payload.error?.message} (${detail})` : payload.error?.message ?? "Send failed",
      payload.error?.code?.toString()
    );
  }

  const messageId = payload.messages?.[0]?.id;
  if (!messageId) throw new WhatsAppCloudError("Meta accepted the request but returned no message id.");
  return messageId;
}

/** Sends freeform text — only valid within 24h of the customer's last message (WhatsApp's session window). */
export async function sendWhatsAppFreeform(to: string, text: string): Promise<string> {
  const config = await getCloudConfig();
  if (!config) {
    throw new WhatsAppCloudError("Meta WhatsApp Cloud API isn't configured.");
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWaId(to),
      type: "text",
      text: { body: text },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as CloudSendResponse;

  if (!response.ok || payload.error) {
    throw new WhatsAppCloudError(payload.error?.message ?? "Send failed", payload.error?.code?.toString());
  }
  const messageId = payload.messages?.[0]?.id;
  if (!messageId) throw new WhatsAppCloudError("Meta accepted the request but returned no message id.");
  return messageId;
}
