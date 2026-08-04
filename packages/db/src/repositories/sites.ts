import "server-only";

import type { Database, DbClient, SiteRow, SiteStatus } from "../types";
import { fail } from "./_helpers";

type SiteInsert = Database["public"]["Tables"]["aiwebsite_sites"]["Insert"];
type SiteUpdate = Database["public"]["Tables"]["aiwebsite_sites"]["Update"];

export async function listSites(
  db: DbClient,
  filters: { leadId?: string; status?: SiteStatus } = {},
  limit = 100
): Promise<SiteRow[]> {
  let query = db.from("aiwebsite_sites").select("*").is("deleted_at", null);
  if (filters.leadId) query = query.eq("lead_id", filters.leadId);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) fail("Failed to list sites", error);
  return data ?? [];
}

export async function getSite(db: DbClient, id: string): Promise<SiteRow | null> {
  const { data, error } = await db
    .from("aiwebsite_sites")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Failed to load site", error);
  return data;
}

/** Renderer lookup: live site by slug (used by apps/sites with admin client). */
export async function getLiveSiteBySlug(db: DbClient, slug: string): Promise<SiteRow | null> {
  const { data, error } = await db
    .from("aiwebsite_sites")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) fail("Failed to resolve site by slug", error);
  return data;
}

export async function isSlugAvailable(db: DbClient, slug: string): Promise<boolean> {
  const { count, error } = await db
    .from("aiwebsite_sites")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);
  if (error) fail("Failed to check slug", error);
  return (count ?? 0) === 0;
}

export async function createSite(db: DbClient, input: SiteInsert): Promise<SiteRow> {
  const { data, error } = await db.from("aiwebsite_sites").insert(input).select("*").single();
  if (error || !data) fail("Failed to create site", error);
  return data;
}

export async function updateSite(db: DbClient, id: string, patch: SiteUpdate): Promise<SiteRow> {
  const { data, error } = await db
    .from("aiwebsite_sites")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update site", error);
  return data;
}

export async function softDeleteSite(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_sites")
    .update({ deleted_at: new Date().toISOString(), status: "archived" as const })
    .eq("id", id);
  if (error) fail("Failed to delete site", error);
}
