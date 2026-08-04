import "server-only";

import type { DbClient, LeadRow } from "../types";
import { fail } from "./_helpers";

export interface AnalyticsFilters {
  fromIso?: string;
  toIso?: string;
  category?: string;
  area?: string;
  source?: string;
  tag?: string;
}

/** Base filtered lead query — reused by every aggregation below. */
function filteredLeads(db: DbClient, filters: AnalyticsFilters) {
  let query = db.from("aiwebsite_leads").select("*").is("deleted_at", null).limit(50000);
  if (filters.fromIso) query = query.gte("created_at", filters.fromIso);
  if (filters.toIso) query = query.lte("created_at", filters.toIso);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.area) query = query.ilike("area", `%${filters.area}%`);
  if (filters.source) query = query.eq("lead_source", filters.source);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  return query;
}

export const FUNNEL_STAGES = [
  "new",
  "website_generated",
  "demo_deployed",
  "whatsapp_sent",
  "demo_viewed",
  "interested",
  "meeting",
  "quotation_sent",
  "won",
] as const;

const STAGE_ORDER = [...FUNNEL_STAGES, "lost"] as const;
const STAGE_RANK = new Map(STAGE_ORDER.map((s, i) => [s, i]));

export interface FunnelStage {
  stage: string;
  count: number;
  conversionFromPrev: number | null;
}

/**
 * Funnel counts: each stage counts leads at that stage OR any later stage
 * (a lead that's Won has passed through every earlier stage), so the
 * funnel monotonically narrows.
 */
export async function getFunnel(db: DbClient, filters: AnalyticsFilters): Promise<FunnelStage[]> {
  const { data, error } = await filteredLeads(db, filters).select("status");
  if (error) fail("Failed to compute funnel", error);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const rank = STAGE_RANK.get(row.status as (typeof STAGE_ORDER)[number]);
    if (rank === undefined) continue;
    for (const stage of FUNNEL_STAGES) {
      const stageRank = STAGE_RANK.get(stage)!;
      if (rank >= stageRank) counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
  }

  const stages: FunnelStage[] = [];
  let prevCount: number | null = null;
  for (const stage of FUNNEL_STAGES) {
    const count = counts.get(stage) ?? 0;
    stages.push({
      stage,
      count,
      conversionFromPrev: prevCount !== null && prevCount > 0 ? count / prevCount : null,
    });
    prevCount = count;
  }
  return stages;
}

export interface WeeklyActivityPoint {
  weekStart: string;
  leads: number;
  generated: number;
  won: number;
}

export async function getWeeklyActivity(
  db: DbClient,
  weeks = 12
): Promise<WeeklyActivityPoint[]> {
  const sinceIso = new Date(Date.now() - weeks * 7 * 86400_000).toISOString();
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("created_at, status")
    .is("deleted_at", null)
    .gte("created_at", sinceIso)
    .limit(50000);
  if (error) fail("Failed to load weekly activity", error);

  function weekStart(iso: string): string {
    const d = new Date(iso);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  const generatedRank = STAGE_RANK.get("website_generated")!;
  const byWeek = new Map<string, WeeklyActivityPoint>();
  for (const row of data ?? []) {
    const week = weekStart(row.created_at);
    const point = byWeek.get(week) ?? { weekStart: week, leads: 0, generated: 0, won: 0 };
    point.leads += 1;
    const rank = STAGE_RANK.get(row.status as (typeof STAGE_ORDER)[number]);
    if (rank !== undefined && rank >= generatedRank) point.generated += 1;
    if (row.status === "won") point.won += 1;
    byWeek.set(week, point);
  }
  return Array.from(byWeek.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface CategoryPerformance {
  category: string;
  total: number;
  won: number;
  winRate: number;
}

export async function getCategoryPerformance(
  db: DbClient,
  filters: AnalyticsFilters
): Promise<CategoryPerformance[]> {
  const { data, error } = await filteredLeads(db, filters)
    .select("category, status")
    .not("category", "is", null);
  if (error) fail("Failed to compute category performance", error);

  const byCategory = new Map<string, { total: number; won: number }>();
  for (const row of data ?? []) {
    const category = row.category ?? "Uncategorized";
    const entry = byCategory.get(category) ?? { total: 0, won: 0 };
    entry.total += 1;
    if (row.status === "won") entry.won += 1;
    byCategory.set(category, entry);
  }
  return Array.from(byCategory.entries())
    .map(([category, { total, won }]) => ({ category, total, won, winRate: total > 0 ? won / total : 0 }))
    .sort((a, b) => b.total - a.total);
}

export interface AreaPerformance {
  area: string;
  total: number;
  won: number;
}

export async function getAreaPerformance(
  db: DbClient,
  filters: AnalyticsFilters
): Promise<AreaPerformance[]> {
  const { data, error } = await filteredLeads(db, filters).select("area, city, status");
  if (error) fail("Failed to compute area performance", error);

  const byArea = new Map<string, { total: number; won: number }>();
  for (const row of data ?? []) {
    const area = row.area ?? row.city ?? "Unknown";
    const entry = byArea.get(area) ?? { total: 0, won: 0 };
    entry.total += 1;
    if (row.status === "won") entry.won += 1;
    byArea.set(area, entry);
  }
  return Array.from(byArea.entries())
    .map(([area, { total, won }]) => ({ area, total, won }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
}

export interface WinRateTrendPoint {
  month: string;
  winRate: number;
  won: number;
  lost: number;
}

export async function getWinRateTrend(db: DbClient, months = 6): Promise<WinRateTrendPoint[]> {
  const sinceIso = new Date(Date.now() - months * 30 * 86400_000).toISOString();
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("status, updated_at")
    .in("status", ["won", "lost"])
    .gte("updated_at", sinceIso)
    .limit(50000);
  if (error) fail("Failed to compute win-rate trend", error);

  const byMonth = new Map<string, { won: number; lost: number }>();
  for (const row of data ?? []) {
    const month = row.updated_at.slice(0, 7);
    const entry = byMonth.get(month) ?? { won: 0, lost: 0 };
    if (row.status === "won") entry.won += 1;
    else entry.lost += 1;
    byMonth.set(month, entry);
  }
  return Array.from(byMonth.entries())
    .map(([month, { won, lost }]) => ({
      month,
      won,
      lost,
      winRate: won + lost > 0 ? won / (won + lost) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface AiCostVsRevenuePoint {
  month: string;
  aiCostInr: number;
  revenueWon: number;
}

export async function getAiCostVsRevenue(db: DbClient, months = 6): Promise<AiCostVsRevenuePoint[]> {
  const sinceIso = new Date(Date.now() - months * 30 * 86400_000).toISOString();
  const [{ data: usage, error: usageError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      db
        .from("aiwebsite_ai_usage_logs")
        .select("created_at, cost_inr")
        .gte("created_at", sinceIso)
        .limit(50000),
      db
        .from("aiwebsite_payments")
        .select("paid_at, amount, status")
        .eq("status", "paid")
        .gte("paid_at", sinceIso)
        .limit(50000),
    ]);
  if (usageError) fail("Failed to load AI usage", usageError);
  if (paymentsError) fail("Failed to load payments", paymentsError);

  const byMonth = new Map<string, AiCostVsRevenuePoint>();
  for (const row of usage ?? []) {
    const month = row.created_at.slice(0, 7);
    const point = byMonth.get(month) ?? { month, aiCostInr: 0, revenueWon: 0 };
    point.aiCostInr += Number(row.cost_inr);
    byMonth.set(month, point);
  }
  for (const row of payments ?? []) {
    if (!row.paid_at) continue;
    const month = row.paid_at.slice(0, 7);
    const point = byMonth.get(month) ?? { month, aiCostInr: 0, revenueWon: 0 };
    point.revenueWon += Number(row.amount);
    byMonth.set(month, point);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** Raw filtered leads for CSV export (kept minimal — no PII beyond what's shown in the CRM). */
export async function getLeadsForExport(db: DbClient, filters: AnalyticsFilters): Promise<LeadRow[]> {
  const { data, error } = await filteredLeads(db, filters);
  if (error) fail("Failed to export leads", error);
  return data ?? [];
}
