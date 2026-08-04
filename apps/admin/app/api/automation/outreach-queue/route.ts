import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { buildOutreachVariables, fillTemplate } from "@aiwebsite/ai";
import { getMessageTemplate } from "@aiwebsite/db/repositories/message-templates";
import { listMessagesByLead } from "@aiwebsite/db/repositories/messages";
import type { LeadRow, LeadStatus } from "@aiwebsite/db/types";

import { leadToFacts } from "@/lib/server/lead-facts";
import { getInboundWebhookSecret, verifyInboundSignature } from "@/lib/server/whatsapp-inbound";
import { demoUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

/**
 * What n8n polls (GET, signed) to know who to WhatsApp next — the outbound
 * half of Phase 6. n8n sends the returned messages via the WhatsApp Cloud
 * API, then reports each one back to POST /api/automation/log-sent so it
 * lands on the lead timeline exactly like a manual send would.
 *
 * The follow-up ladder rides the templates already seeded in Settings →
 * Prompts: pitch → day2 → day5 → day10 (final), each rung only queued once
 * the previous message has aged past its threshold with no reply. A lead
 * drops off the ladder the moment it replies (Phase 4 sets `replied_at`)
 * or advances past `waiting` in the pipeline.
 *
 * Auth: `X-Webhook-Signature: <hex hmac-sha256 of the exact query string>`
 * using the same n8n shared secret as the inbound webhook. Signing the
 * query string (rather than requiring a body) keeps this a plain GET.
 */

const LADDER: { afterMessages: number; minDays: number; templateKey: string; stage: string }[] = [
  { afterMessages: 0, minDays: 0, templateKey: "whatsapp_pitch_v1", stage: "pitch" },
  { afterMessages: 1, minDays: 2, templateKey: "whatsapp_followup_day2", stage: "followup_day2" },
  { afterMessages: 2, minDays: 5, templateKey: "whatsapp_followup_day5", stage: "followup_day5" },
  { afterMessages: 3, minDays: 10, templateKey: "whatsapp_followup_day10", stage: "followup_day10" },
];

/** Ladder stops once a lead has moved past simple "waiting for a reply". */
const LADDER_ELIGIBLE_STATUSES: LeadStatus[] = [
  "website_generated",
  "demo_deployed",
  "whatsapp_sent",
  "demo_viewed",
  "waiting",
];

export interface QueueItem {
  leadId: string;
  stage: string;
  phone: string;
  text: string;
  templateKey: string;
}

export async function GET(request: NextRequest) {
  const secret = await getInboundWebhookSecret();
  const signature = request.headers.get("x-webhook-signature");
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
  }
  const queryString = request.nextUrl.search.replace(/^\?/, "");
  if (!signature || !verifyInboundSignature(queryString, signature, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 25) || 25, 100);
  const db = createAdminSupabase();

  const { data: leads, error } = await db
    .from("aiwebsite_leads")
    .select("*, sites:aiwebsite_sites(slug, status, deleted_at)")
    .in("status", LADDER_ELIGIBLE_STATUSES)
    .is("deleted_at", null)
    .is("replied_at", null)
    .limit(300);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const items: QueueItem[] = [];
  const now = Date.now();

  for (const row of leads ?? []) {
    if (items.length >= limit) break;

    const lead = row as unknown as LeadRow & {
      sites: { slug: string; status: string; deleted_at: string | null }[];
    };
    const liveSite = lead.sites?.find((s) => s.status === "live" && !s.deleted_at);
    if (!liveSite) continue; // nothing to pitch without a live demo

    const phone = lead.whatsapp_e164 ?? lead.phone_e164;
    if (!phone) continue;

    const history = await listMessagesByLead(db, lead.id, 50);
    const outboundWhatsapp = history
      .filter((m) => m.channel === "whatsapp" && m.direction === "outbound")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const rung = LADDER.find((r) => r.afterMessages === outboundWhatsapp.length);
    if (!rung) continue; // already past the last rung — ladder ends here

    const anchor = outboundWhatsapp[outboundWhatsapp.length - 1]?.created_at;
    if (rung.minDays > 0) {
      if (!anchor) continue;
      const daysSince = (now - new Date(anchor).getTime()) / 86400_000;
      if (daysSince < rung.minDays) continue;
    }

    const template = await getMessageTemplate(db, rung.templateKey);
    if (!template) continue; // template missing/inactive — skip rather than send blank text

    const vars = buildOutreachVariables(leadToFacts(lead), demoUrl(liveSite.slug));

    items.push({
      leadId: lead.id,
      stage: rung.stage,
      phone,
      text: fillTemplate(template.body, vars),
      templateKey: rung.templateKey,
    });
  }

  return NextResponse.json({ ok: true, count: items.length, items });
}
