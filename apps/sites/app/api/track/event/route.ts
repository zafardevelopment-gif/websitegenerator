import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";
import { createNotification } from "@aiwebsite/db/repositories/notifications";
import { getSite } from "@aiwebsite/db/repositories/sites";
import { recordEvent } from "@aiwebsite/db/repositories/tracking";
import type { EventType } from "@aiwebsite/db/types";

import { clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EVENT_TYPES = [
  "page_view",
  "section_view",
  "scroll_depth",
  "cta_call",
  "cta_whatsapp",
  "cta_appointment",
  "form_submit",
  "outbound_click",
] as const;

const eventSchema = z.object({
  siteId: z.string().uuid(),
  eventType: z.enum(EVENT_TYPES),
  section: z.string().trim().max(200).nullable().optional(),
  value: z.record(z.string(), z.unknown()).optional(),
});

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

const CTA_EVENTS = new Set<string>(["cta_call", "cta_whatsapp", "cta_appointment"]);
const CTA_LABELS: Record<string, string> = {
  cta_call: "Call button clicked",
  cta_whatsapp: "WhatsApp button clicked",
  cta_appointment: "Appointment/contact clicked",
};

export async function POST(request: Request) {
  if (rateLimited(`event:${clientKey(request)}`)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // Visitors must never see a tracking failure — degrade to a no-op 200.
  try {
    const db = createAdminSupabase();
    const site = await getSite(db, parsed.data.siteId).catch(() => null);
    if (!site || site.deleted_at) return NextResponse.json({ ok: true });

    // Attach to the most recent visit from this request's context — the
    // client doesn't carry a visit id across page lifetime, so we look up
    // the latest visit for this site within the last hour as a best-effort
    // association (analytics-grade, not billing-grade).
    const { data: recentVisit } = await db
      .from("aiwebsite_site_visits")
      .select("id")
      .eq("site_id", site.id)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!recentVisit) return NextResponse.json({ ok: true });

    await recordEvent(db, {
      visit_id: recentVisit.id,
      site_id: site.id,
      event_type: parsed.data.eventType as EventType,
      section: parsed.data.section ?? null,
      value: (parsed.data.value ?? {}) as never,
    });

    if (CTA_EVENTS.has(parsed.data.eventType)) {
      await logLeadActivity(db, site.lead_id, "demo_view", CTA_LABELS[parsed.data.eventType]!, {
        site_id: site.id,
        event: parsed.data.eventType,
      });
      await createNotification(db, {
        type: "demo_cta_click",
        lead_id: site.lead_id,
        site_id: site.id,
        title: `${site.name} — ${CTA_LABELS[parsed.data.eventType]}`,
        detail: { slug: site.slug, event: parsed.data.eventType },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
