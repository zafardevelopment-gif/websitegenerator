import "server-only";

import type { Database, DbClient, SiteEventRow, SiteVisitRow } from "../types";
import { fail } from "./_helpers";

type VisitInsert = Database["public"]["Tables"]["aiwebsite_site_visits"]["Insert"];
type EventInsert = Database["public"]["Tables"]["aiwebsite_site_events"]["Insert"];

// Inserts run with the SERVICE-ROLE client from the ingestion Route
// Handler (Phase 10) — there are intentionally no RLS insert policies.

export async function recordVisit(db: DbClient, input: VisitInsert): Promise<SiteVisitRow> {
  const { data, error } = await db
    .from("aiwebsite_site_visits")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to record visit", error);
  return data;
}

export async function recordEvent(db: DbClient, input: EventInsert): Promise<SiteEventRow> {
  const { data, error } = await db
    .from("aiwebsite_site_events")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to record event", error);
  return data;
}

export interface SiteVisitStats {
  totalVisits: number;
  uniqueVisitors: number;
  ctaClicks: number;
}

/** True if this visitor has ever hit this site before (first-view detection). */
export async function isFirstVisit(
  db: DbClient,
  siteId: string,
  visitorKey: string
): Promise<boolean> {
  const { count, error } = await db
    .from("aiwebsite_site_visits")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("visitor_key", visitorKey)
    .eq("is_internal", false);
  if (error) fail("Failed to check visit history", error);
  return (count ?? 0) === 0;
}

/** Hot leads: sites viewed (non-internal) in the last N hours, ranked by view count. */
export interface HotLeadRow {
  leadId: string;
  siteId: string;
  businessName: string;
  slug: string;
  viewCount: number;
  lastViewedAt: string;
}

export async function listHotLeads(db: DbClient, sinceHours = 48, limit = 20): Promise<HotLeadRow[]> {
  const sinceIso = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data, error } = await db
    .from("aiwebsite_site_visits")
    .select("site_id, created_at, aiwebsite_sites!inner(id, slug, lead_id, name, deleted_at)")
    .eq("is_internal", false)
    .gte("created_at", sinceIso)
    .limit(5000);
  if (error) fail("Failed to load hot leads", error);

  interface Agg {
    leadId: string;
    siteId: string;
    businessName: string;
    slug: string;
    viewCount: number;
    lastViewedAt: string;
  }
  const bySite = new Map<string, Agg>();
  for (const row of data ?? []) {
    const site = row.aiwebsite_sites as unknown as {
      id: string;
      slug: string;
      lead_id: string;
      name: string;
      deleted_at: string | null;
    } | null;
    if (!site || site.deleted_at) continue;
    const existing = bySite.get(site.id);
    if (existing) {
      existing.viewCount += 1;
      if (row.created_at > existing.lastViewedAt) existing.lastViewedAt = row.created_at;
    } else {
      bySite.set(site.id, {
        leadId: site.lead_id,
        siteId: site.id,
        businessName: site.name,
        slug: site.slug,
        viewCount: 1,
        lastViewedAt: row.created_at,
      });
    }
  }
  return Array.from(bySite.values())
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

export async function getSiteVisitStats(
  db: DbClient,
  siteId: string,
  sinceIso?: string
): Promise<SiteVisitStats> {
  let visitsQuery = db
    .from("aiwebsite_site_visits")
    .select("visitor_key")
    .eq("site_id", siteId)
    .eq("is_internal", false)
    .limit(50000);
  if (sinceIso) visitsQuery = visitsQuery.gte("created_at", sinceIso);
  const { data: visits, error: visitsError } = await visitsQuery;
  if (visitsError) fail("Failed to load visit stats", visitsError);

  let eventsQuery = db
    .from("aiwebsite_site_events")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .in("event_type", ["cta_call", "cta_whatsapp", "cta_appointment"]);
  if (sinceIso) eventsQuery = eventsQuery.gte("created_at", sinceIso);
  const { count: ctaClicks, error: eventsError } = await eventsQuery;
  if (eventsError) fail("Failed to load event stats", eventsError);

  const uniqueVisitors = new Set((visits ?? []).map((v) => v.visitor_key)).size;
  return {
    totalVisits: visits?.length ?? 0,
    uniqueVisitors,
    ctaClicks: ctaClicks ?? 0,
  };
}

export interface SiteEngagementSummary {
  viewed: boolean;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  uniqueVisitors: number;
  avgDurationSec: number;
  /** Section keys ranked by view count, most-read first. */
  topSections: { section: string; count: number }[];
  ctaClicks: { call: number; whatsapp: number; appointment: number };
}

/**
 * Full engagement picture for one site — powers the lead-detail "did they
 * actually look?" card (Phase 5). Bot/preview traffic (`is_internal`) is
 * excluded throughout.
 */
export async function getSiteEngagement(db: DbClient, siteId: string): Promise<SiteEngagementSummary> {
  const [{ data: visits, error: visitsError }, { data: events, error: eventsError }] = await Promise.all([
    db
      .from("aiwebsite_site_visits")
      .select("visitor_key, duration_sec, created_at")
      .eq("site_id", siteId)
      .eq("is_internal", false)
      .limit(20000),
    db
      .from("aiwebsite_site_events")
      .select("event_type, section")
      .eq("site_id", siteId)
      .limit(20000),
  ]);
  if (visitsError) fail("Failed to load site engagement (visits)", visitsError);
  if (eventsError) fail("Failed to load site engagement (events)", eventsError);

  const visitRows = visits ?? [];
  const uniqueVisitors = new Set(visitRows.map((v) => v.visitor_key)).size;
  const totalDuration = visitRows.reduce((sum, v) => sum + (v.duration_sec ?? 0), 0);
  const timestamps = visitRows.map((v) => v.created_at).sort();

  const sectionCounts = new Map<string, number>();
  const ctaClicks = { call: 0, whatsapp: 0, appointment: 0 };
  for (const event of events ?? []) {
    if (event.event_type === "section_view" && event.section) {
      sectionCounts.set(event.section, (sectionCounts.get(event.section) ?? 0) + 1);
    }
    if (event.event_type === "cta_call") ctaClicks.call += 1;
    if (event.event_type === "cta_whatsapp") ctaClicks.whatsapp += 1;
    if (event.event_type === "cta_appointment") ctaClicks.appointment += 1;
  }

  return {
    viewed: visitRows.length > 0,
    firstViewedAt: timestamps[0] ?? null,
    lastViewedAt: timestamps[timestamps.length - 1] ?? null,
    viewCount: visitRows.length,
    uniqueVisitors,
    avgDurationSec: visitRows.length > 0 ? Math.round(totalDuration / visitRows.length) : 0,
    topSections: Array.from(sectionCounts.entries())
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    ctaClicks,
  };
}

export async function listRecentVisits(
  db: DbClient,
  siteId: string,
  limit = 50
): Promise<SiteVisitRow[]> {
  const { data, error } = await db
    .from("aiwebsite_site_visits")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list visits", error);
  return data ?? [];
}
