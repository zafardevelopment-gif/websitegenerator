import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { completeDeployment, startDeployment } from "@aiwebsite/db/repositories/deployments";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";

import { revalidateSiteTag } from "@/lib/server/renderer";

export const dynamic = "force-dynamic";

/**
 * Daily cron (vercel.json): expires live demos whose demo_expires_at has
 * passed. Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) or
 * ?secret= for manual runs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && querySecret !== secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabase();
  const { data: expired, error } = await db
    .from("aiwebsite_sites")
    .select("id, slug, name, lead_id")
    .eq("status", "live")
    .eq("mode", "demo")
    .not("demo_expires_at", "is", null)
    .lt("demo_expires_at", new Date().toISOString())
    .is("deleted_at", null)
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: { slug: string; ok: boolean }[] = [];
  for (const site of expired ?? []) {
    try {
      const deployment = await startDeployment(db, site.id, "expire", null);
      await db.from("aiwebsite_sites").update({ status: "expired" }).eq("id", site.id);
      const revalidated = await revalidateSiteTag(site.slug);
      await completeDeployment(db, deployment.id, "success", "auto-expired by cron", [
        { at: new Date().toISOString(), detail: revalidated.detail },
      ]);
      await logLeadActivity(db, site.lead_id, "system", `Demo expired (${site.slug})`, {
        site_id: site.id,
      });
      results.push({ slug: site.slug, ok: true });
    } catch {
      results.push({ slug: site.slug, ok: false });
    }
  }

  return NextResponse.json({
    ok: true,
    expired: results.length,
    results,
    ranAt: new Date().toISOString(),
  });
}
