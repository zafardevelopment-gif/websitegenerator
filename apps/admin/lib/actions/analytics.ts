"use server";

import { createServerSupabase } from "@aiwebsite/db/server";
import {
  getAiCostVsRevenue,
  getAreaPerformance,
  getCategoryPerformance,
  getFunnel,
  getLeadsForExport,
  getWeeklyActivity,
  getWinRateTrend,
  type AiCostVsRevenuePoint,
  type AnalyticsFilters,
  type AreaPerformance,
  type CategoryPerformance,
  type FunnelStage,
  type WeeklyActivityPoint,
  type WinRateTrendPoint,
} from "@aiwebsite/db/repositories/analytics";
import { getSiteVisitStats, listRecentVisits } from "@aiwebsite/db/repositories/tracking";
import type { DeviceType } from "@aiwebsite/db/types";

export interface SiteAnalyticsSnapshot {
  totalVisits: number;
  uniqueVisitors: number;
  ctaClicks: number;
  recentVisits: {
    path: string;
    deviceType: DeviceType;
    createdAt: string;
  }[];
}

export async function getSiteAnalyticsAction(siteId: string): Promise<SiteAnalyticsSnapshot | null> {
  try {
    const supabase = await createServerSupabase();
    const [stats, visits] = await Promise.all([
      getSiteVisitStats(supabase, siteId),
      listRecentVisits(supabase, siteId, 10),
    ]);
    return {
      totalVisits: stats.totalVisits,
      uniqueVisitors: stats.uniqueVisitors,
      ctaClicks: stats.ctaClicks,
      recentVisits: visits
        .filter((v) => !v.is_internal)
        .map((v) => ({ path: v.path, deviceType: v.device_type, createdAt: v.created_at })),
    };
  } catch {
    return null;
  }
}

export interface AnalyticsSnapshot {
  funnel: FunnelStage[];
  weeklyActivity: WeeklyActivityPoint[];
  categoryPerformance: CategoryPerformance[];
  areaPerformance: AreaPerformance[];
  winRateTrend: WinRateTrendPoint[];
  aiCostVsRevenue: AiCostVsRevenuePoint[];
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return supabase;
}

export async function getAnalyticsSnapshotAction(
  filters: AnalyticsFilters
): Promise<AnalyticsSnapshot | null> {
  try {
    const supabase = await requireUser();
    const [funnel, weeklyActivity, categoryPerformance, areaPerformance, winRateTrend, aiCostVsRevenue] =
      await Promise.all([
        getFunnel(supabase, filters),
        getWeeklyActivity(supabase),
        getCategoryPerformance(supabase, filters),
        getAreaPerformance(supabase, filters),
        getWinRateTrend(supabase),
        getAiCostVsRevenue(supabase),
      ]);
    return { funnel, weeklyActivity, categoryPerformance, areaPerformance, winRateTrend, aiCostVsRevenue };
  } catch {
    return null;
  }
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportLeadsCsvAction(filters: AnalyticsFilters): Promise<string> {
  const supabase = await requireUser();
  const leads = await getLeadsForExport(supabase, filters);
  const columns = [
    "business_name",
    "category",
    "owner_name",
    "phone",
    "email",
    "area",
    "city",
    "status",
    "priority",
    "lead_score",
    "google_rating",
    "review_count",
    "lead_source",
    "created_at",
  ] as const;
  const header = columns.join(",");
  const rows = leads.map((lead) => columns.map((col) => csvEscape(lead[col])).join(","));
  return [header, ...rows].join("\n");
}
