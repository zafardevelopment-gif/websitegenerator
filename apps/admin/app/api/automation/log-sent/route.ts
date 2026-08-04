import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getLead, logLeadActivity, setLeadStatus } from "@aiwebsite/db/repositories/leads";
import { getMessageTemplate } from "@aiwebsite/db/repositories/message-templates";
import { createMessage } from "@aiwebsite/db/repositories/messages";

import { getInboundWebhookSecret, verifyInboundSignature } from "@/lib/server/whatsapp-inbound";

export const dynamic = "force-dynamic";

/**
 * n8n calls this right after it successfully sends a queued WhatsApp
 * message (from /api/automation/outreach-queue) via the Cloud API — the
 * other half of Phase 6's outbound loop. Records the message on the lead
 * timeline exactly like a manual send does, so the lead detail page and
 * the ladder logic in outreach-queue see it on the next poll.
 *
 * Auth: same `X-Webhook-Signature` HMAC scheme as the other n8n endpoints.
 */

const bodySchema = z.object({
  lead_id: z.string().uuid(),
  template_key: z.string().max(80).optional(),
  body: z.string().trim().min(1).max(4000),
  provider_message_id: z.string().max(200).optional(),
});

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

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const db = createAdminSupabase();
  const lead = await getLead(db, parsed.data.lead_id);
  if (!lead) {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  }

  let templateId: string | null = null;
  if (parsed.data.template_key) {
    const template = await getMessageTemplate(db, parsed.data.template_key);
    templateId = template?.id ?? null;
  }

  const message = await createMessage(db, {
    lead_id: lead.id,
    channel: "whatsapp",
    template_id: templateId,
    body: parsed.data.body,
    status: "sent",
    direction: "outbound",
    external_id: parsed.data.provider_message_id ?? null,
    sent_at: new Date().toISOString(),
  });

  await logLeadActivity(db, lead.id, "message_sent", "WhatsApp pitch sent (via n8n)", {
    channel: "whatsapp",
    template_key: parsed.data.template_key ?? null,
    message_id: message.id,
  });

  if (lead.status === "new" || lead.status === "website_generated" || lead.status === "demo_deployed") {
    await setLeadStatus(db, lead.id, "whatsapp_sent");
  }

  return NextResponse.json({ ok: true, message_id: message.id });
}
