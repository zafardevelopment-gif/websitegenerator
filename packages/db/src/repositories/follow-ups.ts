import "server-only";

import type { Database, DbClient, FollowUpRow } from "../types";
import { fail } from "./_helpers";

type FollowUpInsert = Database["public"]["Tables"]["aiwebsite_follow_ups"]["Insert"];

export async function createFollowUp(db: DbClient, input: FollowUpInsert): Promise<FollowUpRow> {
  const { data, error } = await db
    .from("aiwebsite_follow_ups")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to create follow-up", error);
  return data;
}

export async function listFollowUpsByLead(db: DbClient, leadId: string): Promise<FollowUpRow[]> {
  const { data, error } = await db
    .from("aiwebsite_follow_ups")
    .select("*")
    .eq("lead_id", leadId)
    .order("due_at", { ascending: true });
  if (error) fail("Failed to list follow-ups", error);
  return data ?? [];
}

export async function listDueFollowUps(db: DbClient, beforeIso: string): Promise<FollowUpRow[]> {
  const { data, error } = await db
    .from("aiwebsite_follow_ups")
    .select("*")
    .eq("status", "pending")
    .lte("due_at", beforeIso)
    .order("due_at", { ascending: true });
  if (error) fail("Failed to list due follow-ups", error);
  return data ?? [];
}

export interface FollowUpWithLead extends FollowUpRow {
  lead: { business_name: string; phone: string | null; whatsapp: string | null } | null;
}

/** All pending/snoozed follow-ups joined with lead identity — powers the dashboard + calendar. */
export async function listActiveFollowUpsWithLead(
  db: DbClient,
  limit = 500
): Promise<FollowUpWithLead[]> {
  const { data, error } = await db
    .from("aiwebsite_follow_ups")
    .select("*, aiwebsite_leads!inner(business_name, phone, whatsapp, deleted_at)")
    .in("status", ["pending", "snoozed"])
    .is("aiwebsite_leads.deleted_at", null)
    .order("due_at", { ascending: true })
    .limit(limit);
  if (error) fail("Failed to list follow-ups", error);

  return (data ?? []).map((row) => {
    const { aiwebsite_leads, ...rest } = row as unknown as FollowUpRow & {
      aiwebsite_leads: { business_name: string; phone: string | null; whatsapp: string | null } | null;
    };
    return { ...rest, lead: aiwebsite_leads };
  });
}

/** True if the lead already has a pending/snoozed follow-up (dedup for auto-suggest). */
export async function hasActiveFollowUp(db: DbClient, leadId: string): Promise<boolean> {
  const { count, error } = await db
    .from("aiwebsite_follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .in("status", ["pending", "snoozed"]);
  if (error) fail("Failed to check active follow-ups", error);
  return (count ?? 0) > 0;
}

export async function snoozeFollowUp(db: DbClient, id: string, newDueIso: string): Promise<void> {
  const { data: existing, error: readError } = await db
    .from("aiwebsite_follow_ups")
    .select("due_at")
    .eq("id", id)
    .single();
  if (readError || !existing) fail("Failed to load follow-up", readError);

  const { error } = await db
    .from("aiwebsite_follow_ups")
    .update({ due_at: newDueIso, status: "snoozed", snoozed_from: existing.due_at })
    .eq("id", id);
  if (error) fail("Failed to snooze follow-up", error);
}

export async function completeFollowUp(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_follow_ups")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("Failed to complete follow-up", error);
}

export async function cancelFollowUp(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_follow_ups")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) fail("Failed to cancel follow-up", error);
}
