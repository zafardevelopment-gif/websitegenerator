import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { listDueFollowUps } from "@aiwebsite/db/repositories/follow-ups";
import { createNotification } from "@aiwebsite/db/repositories/notifications";
import { listHotLeads } from "@aiwebsite/db/repositories/tracking";

export const dynamic = "force-dynamic";

/**
 * Daily cron (vercel.json): compiles due/overdue follow-ups, hot leads,
 * and demos expiring within 3 days into one in-app notification.
 * Auth: `Authorization: Bearer <CRON_SECRET>` or ?secret= for manual runs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && querySecret !== secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabase();

  const [dueFollowUps, hotLeads, expiringSoon] = await Promise.all([
    listDueFollowUps(db, new Date().toISOString()),
    listHotLeads(db, 48, 50),
    db
      .from("aiwebsite_sites")
      .select("id, name, slug")
      .eq("status", "live")
      .eq("mode", "demo")
      .not("demo_expires_at", "is", null)
      .lte("demo_expires_at", new Date(Date.now() + 3 * 86400_000).toISOString())
      .gte("demo_expires_at", new Date().toISOString())
      .is("deleted_at", null)
      .limit(50)
      .then((r) => r.data ?? []),
  ]);

  const summaryParts: string[] = [];
  if (dueFollowUps.length > 0) summaryParts.push(`${dueFollowUps.length} follow-up(s) due`);
  if (hotLeads.length > 0) summaryParts.push(`${hotLeads.length} hot lead(s)`);
  if (expiringSoon.length > 0) summaryParts.push(`${expiringSoon.length} demo(s) expiring soon`);

  if (summaryParts.length === 0) {
    return NextResponse.json({ ok: true, skipped: "nothing to report", ranAt: new Date().toISOString() });
  }

  await createNotification(db, {
    type: "daily_digest",
    lead_id: null,
    site_id: null,
    title: `Daily digest: ${summaryParts.join(" · ")}`,
    detail: {
      followUps: dueFollowUps.map((f) => ({ id: f.id, leadId: f.lead_id, dueAt: f.due_at })),
      hotLeads: hotLeads.map((h) => ({ leadId: h.leadId, businessName: h.businessName, views: h.viewCount })),
      expiring: expiringSoon.map((s) => ({ siteId: s.id, name: s.name, slug: s.slug })),
    },
  });

  return NextResponse.json({
    ok: true,
    dueFollowUps: dueFollowUps.length,
    hotLeads: hotLeads.length,
    expiringSoon: expiringSoon.length,
    ranAt: new Date().toISOString(),
  });
}
