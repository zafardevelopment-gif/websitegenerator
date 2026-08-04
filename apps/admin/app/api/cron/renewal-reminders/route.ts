import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { listUpcomingRenewals } from "@aiwebsite/db/repositories/clients";
import { createNotification } from "@aiwebsite/db/repositories/notifications";

export const dynamic = "force-dynamic";

const REMINDER_WINDOWS = [30, 7, 1] as const;

function daysUntil(dateStr: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const msPerDay = 86400_000;
  return Math.round((new Date(dateStr).getTime() - new Date(today).getTime()) / msPerDay);
}

/**
 * Daily cron (vercel.json): notifies the team when a client's domain or
 * hosting renewal is exactly 30, 7, or 1 day(s) away — fires once per
 * window per client rather than every day within it.
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
  const clients = await listUpcomingRenewals(db, 30);

  const notified: { clientId: string; businessName: string; days: number; field: string }[] = [];

  for (const client of clients) {
    for (const field of ["domain_expiry", "renewal_date"] as const) {
      const dateStr = client[field];
      if (!dateStr) continue;
      const days = daysUntil(dateStr);
      if (!REMINDER_WINDOWS.includes(days as (typeof REMINDER_WINDOWS)[number])) continue;

      await createNotification(db, {
        type: "renewal_reminder",
        lead_id: client.lead_id,
        site_id: client.site_id,
        title: `${client.business_name}: ${field === "domain_expiry" ? "domain" : "renewal"} due in ${days} day(s)`,
        detail: { client_id: client.id, field, date: dateStr, days },
      });
      notified.push({ clientId: client.id, businessName: client.business_name, days, field });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: clients.length,
    notified: notified.length,
    details: notified,
    ranAt: new Date().toISOString(),
  });
}
