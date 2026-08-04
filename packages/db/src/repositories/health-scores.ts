import "server-only";

import type { Database, DbClient, HealthScoreRow } from "../types";
import { fail } from "./_helpers";

type HealthScoreInsert = Database["public"]["Tables"]["aiwebsite_health_scores"]["Insert"];

export async function createHealthScore(
  db: DbClient,
  input: HealthScoreInsert
): Promise<HealthScoreRow> {
  const { data, error } = await db
    .from("aiwebsite_health_scores")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to save health score", error);
  return data;
}

export async function getLatestHealthScore(
  db: DbClient,
  siteId: string
): Promise<HealthScoreRow | null> {
  const { data, error } = await db
    .from("aiwebsite_health_scores")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Failed to load health score", error);
  return data;
}

export async function listHealthScores(db: DbClient, siteId: string): Promise<HealthScoreRow[]> {
  const { data, error } = await db
    .from("aiwebsite_health_scores")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) fail("Failed to list health scores", error);
  return data ?? [];
}
