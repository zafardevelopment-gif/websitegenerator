import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@aiwebsite/db/admin";
import { completeDeployment, startDeployment } from "@aiwebsite/db/repositories/deployments";
import { releaseSlotForSite, sweepDemoSlots } from "@aiwebsite/db/repositories/demo-slots";
import { logLeadActivity } from "@aiwebsite/db/repositories/leads";
import { createNotification } from "@aiwebsite/db/repositories/notifications";
import { createFollowUp, hasActiveFollowUp } from "@aiwebsite/db/repositories/follow-ups";
import type { LeadStatus } from "@aiwebsite/db/types";

import { revalidateSiteTag } from "@/lib/server/renderer";

export const dynamic = "force-dynamic";

/** A live conversation in progress — never auto-expire the demo under it. */
const PROTECTED_LEAD_STATUSES: LeadStatus[] = ["interested", "meeting", "negotiation"];

const WARN_WINDOW_DAYS = 3;

interface ExpiryCandidate {
  id: string;
  slug: string;
  name: string;
  lead_id: string;
  demo_expires_at: string | null;
  lead: { status: LeadStatus } | null;
}

/**
 * Daily cron (vercel.json): two jobs in one run —
 *  1. Warn at T-3 days: in-app notification + follow-up task, once per expiry.
 *  2. At T-0: expire the site, release its slot to cooldown, then sweep
 *     cooldown → free for slots whose cooldown has already elapsed.
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) or ?secret= for
 * manual runs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && querySecret !== secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabase();
  const now = new Date();
  const warnBefore = new Date(now.getTime() + WARN_WINDOW_DAYS * 86400_000).toISOString();

  const { data: candidates, error } = await db
    .from("aiwebsite_sites")
    .select("id, slug, name, lead_id, demo_expires_at, lead:aiwebsite_leads(status)")
    .eq("status", "live")
    .eq("mode", "demo")
    .not("demo_expires_at", "is", null)
    .lt("demo_expires_at", warnBefore)
    .is("deleted_at", null)
    .limit(300);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (candidates ?? []) as unknown as ExpiryCandidate[];
  const nowIso = now.toISOString();

  const warned: { slug: string }[] = [];
  const expired: { slug: string; ok: boolean }[] = [];
  const postponed: { slug: string; reason: string }[] = [];

  for (const site of rows) {
    const isPastDue = !!site.demo_expires_at && site.demo_expires_at < nowIso;
    const leadStatus = site.lead?.status;
    const isProtected = leadStatus ? PROTECTED_LEAD_STATUSES.includes(leadStatus) : false;

    if (!isPastDue) {
      // T-3 warning window — fire once per expiry (dedup on existing
      // notification for this exact expires_at).
      const { count } = await db
        .from("aiwebsite_notifications")
        .select("id", { count: "exact", head: true })
        .eq("site_id", site.id)
        .eq("type", "demo_expiring_soon")
        .contains("detail", { expires_at: site.demo_expires_at });
      if ((count ?? 0) > 0) continue;

      await createNotification(db, {
        type: "demo_expiring_soon",
        lead_id: site.lead_id,
        site_id: site.id,
        title: `${site.name}: demo expires in ${WARN_WINDOW_DAYS} days`,
        detail: { site_id: site.id, expires_at: site.demo_expires_at },
      });
      if (!(await hasActiveFollowUp(db, site.lead_id))) {
        await createFollowUp(db, {
          lead_id: site.lead_id,
          due_at: nowIso,
          note: `Demo (${site.slug}) expires soon — follow up or extend before it goes down.`,
        });
      }
      warned.push({ slug: site.slug });
      continue;
    }

    if (isProtected) {
      // Live conversation — leave it running, warn again next run instead
      // of silently killing the demo mid-negotiation.
      postponed.push({ slug: site.slug, reason: `lead status: ${leadStatus}` });
      continue;
    }

    try {
      const deployment = await startDeployment(db, site.id, "expire", null);
      await db.from("aiwebsite_sites").update({ status: "expired" }).eq("id", site.id);
      await releaseSlotForSite(db, site.id, { note: "auto-expired by cron" });
      const revalidated = await revalidateSiteTag(site.slug);
      await completeDeployment(db, deployment.id, "success", "auto-expired by cron", [
        { at: new Date().toISOString(), detail: revalidated.detail },
      ]);
      await logLeadActivity(db, site.lead_id, "system", `Demo expired (${site.slug})`, {
        site_id: site.id,
      });
      expired.push({ slug: site.slug, ok: true });
    } catch {
      expired.push({ slug: site.slug, ok: false });
    }
  }

  const handedOff = await sweepDomainHandoffs(db);

  const swept = await sweepDemoSlots(db);

  return NextResponse.json({
    ok: true,
    warned: warned.length,
    expired: expired.length,
    postponed: postponed.length,
    handedOff: handedOff.length,
    sweptFromCooldown: swept,
    details: { warned, expired, postponed, handedOff },
    ranAt: new Date().toISOString(),
  });
}

/**
 * Phase 7: once a won deal's domain-handoff grace window has passed, the
 * old demo slot has been redirecting for two weeks — time to reclaim it.
 * Clears the redirect (the domain is presumably indexed/bookmarked by now
 * and doesn't need the old link anymore) and releases the slot straight
 * to the pool, no cooldown — this slug was never shown to a new prospect
 * during the redirect window, so there's no stale-content risk.
 */
async function sweepDomainHandoffs(db: ReturnType<typeof createAdminSupabase>): Promise<{ siteId: string }[]> {
  const { data: rows, error } = await db
    .from("aiwebsite_sites")
    .select("id, lead_id, redirect_to_domain")
    .not("redirect_to_domain", "is", null)
    .not("redirect_grace_ends_at", "is", null)
    .lt("redirect_grace_ends_at", new Date().toISOString())
    .is("deleted_at", null)
    .limit(200);
  if (error || !rows) return [];

  const done: { siteId: string }[] = [];
  for (const row of rows) {
    try {
      await releaseSlotForSite(db, row.id, { cooldownDays: 0, note: "domain hand-off grace ended" });
      await db
        .from("aiwebsite_sites")
        .update({ redirect_to_domain: null, redirect_grace_ends_at: null })
        .eq("id", row.id);
      await logLeadActivity(db, row.lead_id, "system", `Demo slot reclaimed — ${row.redirect_to_domain} is now the permanent home`, {
        site_id: row.id,
      });
      done.push({ siteId: row.id });
    } catch {
      // Leave it for the next run rather than half-apply the cleanup.
    }
  }
  return done;
}
