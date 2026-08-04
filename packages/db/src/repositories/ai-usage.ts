import "server-only";

import type { AiUsageLogRow, Database, DbClient } from "../types";
import { fail } from "./_helpers";

type UsageInsert = Database["public"]["Tables"]["aiwebsite_ai_usage_logs"]["Insert"];

export async function logAiUsage(db: DbClient, input: UsageInsert): Promise<void> {
  const { error } = await db.from("aiwebsite_ai_usage_logs").insert(input);
  if (error) fail("Failed to log AI usage", error);
}

export interface AiMonthlyCost {
  totalCostInr: number;
  totalTokensIn: number;
  totalTokensOut: number;
  calls: number;
}

/** Aggregated spend for the calendar month containing `date`. */
export async function getMonthlyAiCost(db: DbClient, date = new Date()): Promise<AiMonthlyCost> {
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
  const { data, error } = await db
    .from("aiwebsite_ai_usage_logs")
    .select("cost_inr, tokens_in, tokens_out")
    .gte("created_at", monthStart)
    .limit(50000);
  if (error) fail("Failed to load AI usage", error);

  let totalCostInr = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  for (const row of data ?? []) {
    totalCostInr += Number(row.cost_inr);
    totalTokensIn += row.tokens_in;
    totalTokensOut += row.tokens_out;
  }
  return {
    totalCostInr: Number(totalCostInr.toFixed(2)),
    totalTokensIn,
    totalTokensOut,
    calls: data?.length ?? 0,
  };
}

export async function listAiUsage(db: DbClient, limit = 100): Promise<AiUsageLogRow[]> {
  const { data, error } = await db
    .from("aiwebsite_ai_usage_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list AI usage", error);
  return data ?? [];
}
