import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { logLeadActivity, setLeadStatus } from "@aiwebsite/db/repositories/leads";
import { createNotification } from "@aiwebsite/db/repositories/notifications";
import { getSite } from "@aiwebsite/db/repositories/sites";
import { isFirstVisit, recordVisit } from "@aiwebsite/db/repositories/tracking";
import type { DeviceType } from "@aiwebsite/db/types";

import { clientKey, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const visitSchema = z.object({
  siteId: z.string().uuid(),
  visitorKey: z.string().trim().min(1).max(100),
  deviceType: z.enum(["mobile", "tablet", "desktop", "other"]).default("other"),
  path: z.string().trim().max(300).default("/"),
  referrer: z.string().trim().max(500).default(""),
});

/** Beacon POST bodies have no JSON content-type guarantee — parse manually. */
async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export async function POST(request: Request) {
  if (rateLimited(`visit:${clientKey(request)}`)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = visitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // Visitors must never see a tracking failure — degrade to a no-op 200.
  try {
    const db = createAdminSupabase();
    const site = await getSite(db, parsed.data.siteId).catch(() => null);
    if (!site || site.deleted_at) return NextResponse.json({ ok: true });

    const userAgent = request.headers.get("user-agent") ?? "";
    const isInternal = /bot|crawl|spider|preview|slurp|facebookexternalhit|whatsapp/i.test(
      userAgent
    );

    const wasFirstVisit = await isFirstVisit(db, site.id, parsed.data.visitorKey);

    const visit = await recordVisit(db, {
      site_id: site.id,
      visitor_key: parsed.data.visitorKey,
      device_type: parsed.data.deviceType as DeviceType,
      user_agent: userAgent.slice(0, 500),
      referrer: parsed.data.referrer.slice(0, 500) || null,
      path: parsed.data.path,
      is_internal: isInternal,
    });

    if (!isInternal) {
      await logLeadActivity(
        db,
        site.lead_id,
        "demo_view",
        `Demo viewed (${parsed.data.deviceType})`,
        { site_id: site.id, visit_id: visit.id }
      );

      if (site.status === "live") {
        const { data: lead } = await db
          .from("aiwebsite_leads")
          .select("status")
          .eq("id", site.lead_id)
          .maybeSingle();
        if (lead?.status === "whatsapp_sent") {
          await setLeadStatus(db, site.lead_id, "demo_viewed");
        }
      }

      if (wasFirstVisit) {
        await createNotification(db, {
          type: "demo_first_view",
          lead_id: site.lead_id,
          site_id: site.id,
          title: `${site.name} — demo viewed for the first time`,
          detail: { slug: site.slug, device: parsed.data.deviceType },
        });
      }
    }

    return NextResponse.json({ ok: true, visitId: visit.id });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
