import { NextResponse, type NextRequest } from "next/server";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

import {
  handleInboundMessage,
  handleStatusCallback,
  type InboundMessageBody,
  type StatusCallbackBody,
} from "../whatsapp-inbound/route";

export const dynamic = "force-dynamic";

/**
 * Native Meta WhatsApp Cloud API webhook — receives inbound messages and
 * delivery statuses directly from Meta (no n8n hop needed). Configure this
 * URL in Meta for Developers → your app → WhatsApp → Configuration →
 * Webhook, with the same verify token saved in Settings → API Keys.
 */

interface MetaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
}

interface MetaStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
}

interface MetaWebhookBody {
  object?: string;
  entry?: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messaging_product?: string;
        messages?: MetaMessage[];
        statuses?: MetaStatus[];
      };
    }>;
  }>;
}

function messageText(m: MetaMessage): string {
  return (
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    `[unsupported message type: ${m.type}]`
  );
}

/** Meta's handshake: echoes hub.challenge back once the verify token matches. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const db = createAdminSupabase();
  const expected = await getDecryptedSetting(db, SETTING_KEYS.whatsappCloudVerifyToken).catch(
    () => null
  );

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ ok: false, error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  let body: MetaWebhookBody;
  try {
    body = await request.json();
  } catch {
    // Always 200 — Meta disables the webhook after too many non-2xx responses.
    return NextResponse.json({ ok: true, skipped: "invalid JSON" });
  }

  const db = createAdminSupabase();

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        for (const message of value.messages ?? []) {
          const inbound: InboundMessageBody = {
            from: message.from,
            body: messageText(message),
            provider_message_id: message.id,
            timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
          };
          await handleInboundMessage(db, inbound);
        }
        for (const status of value.statuses ?? []) {
          if (status.status === "sent" || status.status === "delivered" || status.status === "read" || status.status === "failed") {
            const callback: StatusCallbackBody = {
              event: "status",
              provider_message_id: status.id,
              status: status.status,
            };
            await handleStatusCallback(db, callback);
          }
        }
      }
    }
  } catch (e) {
    console.error("Meta WhatsApp webhook processing error:", e);
  }

  return NextResponse.json({ ok: true });
}
