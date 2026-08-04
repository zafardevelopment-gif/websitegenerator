import "server-only";

import type {
  ActivityType,
  Database,
  DbClient,
  Json,
  LeadActivityRow,
  LeadRow,
  LeadStatus,
  Priority,
} from "../types";
import { fail, pageRange, sanitizeSearch, type PageParams } from "./_helpers";

type LeadInsert = Database["public"]["Tables"]["aiwebsite_leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["aiwebsite_leads"]["Update"];

export interface LeadFilters {
  search?: string;
  status?: LeadStatus;
  priority?: Priority;
  category?: string;
  city?: string;
  area?: string;
  tag?: string;
  /** "deleted" shows the trash view; default shows active leads. */
  view?: "active" | "deleted";
}

export type LeadSortColumn =
  | "created_at"
  | "updated_at"
  | "business_name"
  | "lead_score"
  | "google_rating"
  | "next_follow_up"
  | "last_contacted_at";

export interface LeadSort {
  column: LeadSortColumn;
  ascending: boolean;
}

export interface LeadListResult {
  rows: LeadRow[];
  count: number;
}

export async function listLeads(
  db: DbClient,
  filters: LeadFilters,
  page: PageParams,
  sort: LeadSort = { column: "created_at", ascending: false }
): Promise<LeadListResult> {
  let query = db.from("aiwebsite_leads").select("*", { count: "exact" });

  if (filters.view === "deleted") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters.area) query = query.ilike("area", `%${filters.area}%`);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.search) {
    const s = sanitizeSearch(filters.search);
    if (s) {
      query = query.or(
        `business_name.ilike.%${s}%,owner_name.ilike.%${s}%,phone.ilike.%${s}%,area.ilike.%${s}%,city.ilike.%${s}%`
      );
    }
  }

  const { from, to } = pageRange(page);
  const { data, error, count } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .range(from, to);
  if (error) fail("Failed to list leads", error);
  return { rows: data ?? [], count: count ?? 0 };
}

/** Lightweight search for the Cmd+K palette. */
export async function searchLeads(db: DbClient, term: string, limit = 8): Promise<LeadRow[]> {
  const s = sanitizeSearch(term);
  if (!s) return [];
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("*")
    .is("deleted_at", null)
    .or(`business_name.ilike.%${s}%,owner_name.ilike.%${s}%,phone.ilike.%${s}%,area.ilike.%${s}%`)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) fail("Lead search failed", error);
  return data ?? [];
}

export async function getLead(db: DbClient, id: string): Promise<LeadRow | null> {
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Failed to load lead", error);
  return data;
}

export async function createLead(db: DbClient, input: LeadInsert): Promise<LeadRow> {
  const { data, error } = await db
    .from("aiwebsite_leads")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to create lead", error);
  return data;
}

export async function updateLead(db: DbClient, id: string, patch: LeadUpdate): Promise<LeadRow> {
  const { data, error } = await db
    .from("aiwebsite_leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update lead", error);
  return data;
}

/** Status changes go through update; the DB trigger logs the timeline entry. */
export async function setLeadStatus(db: DbClient, id: string, status: LeadStatus): Promise<LeadRow> {
  return updateLead(db, id, { status });
}

export async function softDeleteLead(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("Failed to delete lead", error);
}

export async function restoreLead(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_leads")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) fail("Failed to restore lead", error);
}

// ── Timeline ────────────────────────────────────────────────────────

export async function listLeadActivities(
  db: DbClient,
  leadId: string,
  limit = 100
): Promise<LeadActivityRow[]> {
  const { data, error } = await db
    .from("aiwebsite_lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to load lead timeline", error);
  return data ?? [];
}

export async function logLeadActivity(
  db: DbClient,
  leadId: string,
  type: ActivityType,
  title: string,
  detail: Json = {},
  actorId: string | null = null
): Promise<void> {
  const { error } = await db.from("aiwebsite_lead_activities").insert({
    lead_id: leadId,
    type,
    title,
    detail,
    actor_id: actorId,
  });
  if (error) fail("Failed to log lead activity", error);
}

export async function addLeadNote(
  db: DbClient,
  leadId: string,
  note: string,
  actorId: string
): Promise<void> {
  await logLeadActivity(db, leadId, "note", note, {}, actorId);
}

/** All active leads (capped) — powers Kanban and Map views. */
export async function listActiveLeads(db: DbClient, limit = 1000): Promise<LeadRow[]> {
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("*")
    .is("deleted_at", null)
    .order("lead_score", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to load leads", error);
  return data ?? [];
}

/** Chunked bulk insert for the importer. Returns inserted count. */
export async function bulkInsertLeads(
  db: DbClient,
  rows: LeadInsert[],
  chunkSize = 200
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error, count } = await db
      .from("aiwebsite_leads")
      .insert(chunk, { count: "exact" });
    if (error) fail(`Failed to insert leads (batch ${i / chunkSize + 1})`, error);
    inserted += count ?? chunk.length;
  }
  return inserted;
}

/** Existing phone/place_id keys for duplicate detection during import. */
export async function getDedupeKeys(
  db: DbClient
): Promise<{ phones: Set<string>; placeIds: Set<string> }> {
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("phone, place_id")
    .is("deleted_at", null)
    .limit(50000);
  if (error) fail("Failed to load dedupe keys", error);

  const phones = new Set<string>();
  const placeIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.phone) phones.add(row.phone.replace(/[^0-9]/g, "").slice(-10));
    if (row.place_id) placeIds.add(row.place_id);
  }
  return { phones, placeIds };
}

/** Status → count map for funnel/dashboard widgets. */
export async function countLeadsByStatus(db: DbClient): Promise<Record<LeadStatus, number>> {
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("status")
    .is("deleted_at", null)
    .limit(50000);
  if (error) fail("Failed to count leads", error);

  const counts = {} as Record<LeadStatus, number>;
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}
