import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { createNotification } from "@aiwebsite/db/repositories/notifications";
import { findLeadByPhone, logLeadActivity, normalizePhoneE164, updateLead } from "@aiwebsite/db/repositories/leads";
import { createMessage, getMessageByExternalId, updateMessage } from "@aiwebsite/db/repositories/messages";
import type { LeadRow, LeadStatus, MessageStatus } from "@aiwebsite/db/types";

import { getInboundWebhookSecret, verifyInboundSignature } from "@/lib/server/whatsapp-inbound";
import {
  getWhatsAppCallbackNumber,
  isWhatsAppCloudConfigured,
  sendWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
} from "@/lib/server/whatsapp-cloud";
import { buildReplyFollowupTemplateParams } from "@/lib/whatsapp-pitch";

export const dynamic = "force-dynamic";

/**
 * Single inbound surface for n8n (Phase 6 wires the workflow; this route
 * is usable standalone today via curl/Postman for testing).
 *
 * Two payload shapes, told apart by `event`:
 *
 *  Inbound message (default if `event` is omitted):
 *    { "from": "9876543210", "body": "Yes interested", "provider_message_id": "wamid.xxx" }
 *
 *  Delivery-status callback:
 *    { "event": "status", "provider_message_id": "wamid.xxx", "status": "delivered" }
 *
 * Auth: `X-Webhook-Signature: <hex hmac-sha256 of the raw body>` using the
 * secret from Settings → API Keys → n8n / WhatsApp inbound (rotatable,
 * `WHATSAPP_INBOUND_WEBHOOK_SECRET` env wins if set).
 */

export interface InboundMessageBody {
  event?: "message";
  from: string;
  body: string;
  provider_message_id?: string;
  timestamp?: string;
}

export interface StatusCallbackBody {
  event: "status";
  provider_message_id: string;
  status: "sent" | "delivered" | "read" | "failed";
}

type WebhookBody = InboundMessageBody | StatusCallbackBody;

/** Never downgrade a later pipeline stage on an auto-advance. */
const STAGE_RANK: Record<LeadStatus, number> = {
  new: 0,
  website_generated: 1,
  demo_deployed: 2,
  whatsapp_sent: 3,
  demo_viewed: 4,
  waiting: 5,
  interested: 6,
  meeting: 7,
  quotation_sent: 8,
  negotiation: 9,
  won: 10,
  lost: 11,
};

const STATUS_TO_MESSAGE_STATUS: Record<StatusCallbackBody["status"], MessageStatus> = {
  sent: "sent",
  delivered: "delivered",
  read: "opened",
  failed: "failed",
};

/** Delivery states only move forward — a re-delivered "sent" never undoes a "read". */
const MESSAGE_STATUS_RANK: Record<MessageStatus, number> = {
  draft: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  read: 3,
  failed: 4,
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const secret = await getInboundWebhookSecret();

  if (!secret) {
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
  }
  if (!signature || !verifyInboundSignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const db = createAdminSupabase();

  if (body.event === "status") {
    return handleStatusCallback(db, body);
  }
  return handleInboundMessage(db, body);
}

export async function handleStatusCallback(db: ReturnType<typeof createAdminSupabase>, body: StatusCallbackBody) {
  if (!body.provider_message_id || !body.status) {
    return NextResponse.json({ ok: false, error: "provider_message_id and status are required" }, { status: 400 });
  }
  const nextStatus = STATUS_TO_MESSAGE_STATUS[body.status];
  if (!nextStatus) {
    return NextResponse.json({ ok: true, skipped: `unhandled status ${body.status}` });
  }

  const message = await getMessageByExternalId(db, body.provider_message_id);
  if (!message) {
    // Ack anyway — the provider will retry indefinitely otherwise.
    return NextResponse.json({ ok: true, skipped: "message not found for provider id" });
  }

  if (MESSAGE_STATUS_RANK[nextStatus] <= MESSAGE_STATUS_RANK[message.status]) {
    return NextResponse.json({ ok: true, skipped: "status already at or past this stage" });
  }

  const now = new Date().toISOString();
  await updateMessage(db, message.id, {
    status: nextStatus,
    delivered_at: nextStatus === "delivered" ? now : message.delivered_at,
    opened_at: nextStatus === "opened" ? now : message.opened_at,
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}

export async function handleInboundMessage(db: ReturnType<typeof createAdminSupabase>, body: InboundMessageBody) {
  if (!body.from || !body.body) {
    return NextResponse.json({ ok: false, error: "from and body are required" }, { status: 400 });
  }

  const e164 = normalizePhoneE164(body.from);
  if (!e164) {
    return NextResponse.json({ ok: false, error: "Could not normalize 'from' to a phone number" }, { status: 400 });
  }

  // Idempotent on provider_message_id — a retried webhook must not create a duplicate.
  if (body.provider_message_id) {
    const existing = await getMessageByExternalId(db, body.provider_message_id);
    if (existing) {
      return NextResponse.json({ ok: true, skipped: "already recorded", message_id: existing.id });
    }
  }

  const { lead, ambiguous, matches } = await findLeadByPhone(db, e164);

  if (ambiguous) {
    await createNotification(db, {
      type: "inbound_reply_ambiguous",
      title: `Reply from ${e164} matches ${matches.length} leads — needs review`,
      detail: { phone: e164, body: body.body, lead_ids: matches.map((m) => m.id) },
    });
    return NextResponse.json({ ok: true, skipped: "ambiguous — flagged for review" });
  }

  if (!lead) {
    await createNotification(db, {
      type: "inbound_reply_ambiguous",
      title: `Reply from unknown number ${e164}`,
      detail: { phone: e164, body: body.body, reason: "no matching lead" },
    });
    return NextResponse.json({ ok: true, skipped: "no matching lead" });
  }

  const now = new Date().toISOString();
  const message = await createMessage(db, {
    lead_id: lead.id,
    channel: "whatsapp",
    body: body.body,
    status: "delivered",
    direction: "inbound",
    external_id: body.provider_message_id ?? null,
    sent_at: body.timestamp ?? now,
    delivered_at: now,
  });

  await logLeadActivity(db, lead.id, "message_received", "WhatsApp reply received", {
    message_id: message.id,
    preview: body.body.slice(0, 200),
  });

  // Auto-advance whatsapp_sent/demo_viewed/waiting → interested on first
  // reply; never downgrade a lead already further along the pipeline.
  const patch: { replied_at: string; status?: LeadStatus } = { replied_at: now };
  if (STAGE_RANK[lead.status] <= STAGE_RANK.waiting) {
    patch.status = "interested";
  }
  await updateLead(db, lead.id, patch);

  await createNotification(db, {
    type: "inbound_reply",
    lead_id: lead.id,
    title: `${lead.business_name} replied on WhatsApp`,
    detail: { message_id: message.id, preview: body.body.slice(0, 200) },
  });

  // Best effort — a reply is recorded above regardless of whether the
  // auto follow-up succeeds (unconfigured Cloud API, unapproved template).
  await sendReplyFollowup(db, lead).catch((e) => {
    console.error("Auto reply-followup send failed:", e);
  });

  return NextResponse.json({ ok: true, lead_id: lead.id, message_id: message.id });
}

/** Sends the approved `reply_team_followup` template once a lead's first reply comes in. */
async function sendReplyFollowup(db: ReturnType<typeof createAdminSupabase>, lead: LeadRow) {
  const phone = lead.whatsapp ?? lead.phone;
  if (!phone) return;
  if (!(await isWhatsAppCloudConfigured())) return;

  const callNumber = (await getWhatsAppCallbackNumber()) ?? "";
  const messageId = await sendWhatsAppTemplate({
    to: phone,
    template: WHATSAPP_TEMPLATES.replyFollowup,
    bodyParams: buildReplyFollowupTemplateParams({
      ownerName: lead.owner_name,
      category: lead.category,
      callNumber,
    }),
  });

  await createMessage(db, {
    lead_id: lead.id,
    channel: "whatsapp",
    body: `Thanks for your reply, ${lead.owner_name ?? "there"} — our team will contact you shortly. Call ${callNumber} anytime.`,
    status: "sent",
    direction: "outbound",
    external_id: messageId,
    sent_at: new Date().toISOString(),
  });
}
