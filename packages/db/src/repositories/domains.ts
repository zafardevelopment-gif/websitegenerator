import "server-only";

import type { Database, DbClient, DomainRow, DomainStatus } from "../types";
import { fail } from "./_helpers";

type DomainInsert = Database["public"]["Tables"]["aiwebsite_domains"]["Insert"];
type DomainUpdate = Database["public"]["Tables"]["aiwebsite_domains"]["Update"];

export async function createDomain(db: DbClient, input: DomainInsert): Promise<DomainRow> {
  const { data, error } = await db.from("aiwebsite_domains").insert(input).select("*").single();
  if (error || !data) fail("Failed to add domain", error);
  return data;
}

/** Renderer lookup: which site serves this custom domain? */
export async function getDomain(db: DbClient, domain: string): Promise<DomainRow | null> {
  const { data, error } = await db
    .from("aiwebsite_domains")
    .select("*")
    .eq("domain", domain.toLowerCase())
    .neq("status", "removed")
    .maybeSingle();
  if (error) fail("Failed to resolve domain", error);
  return data;
}

export async function updateDomain(
  db: DbClient,
  id: string,
  patch: DomainUpdate
): Promise<DomainRow> {
  const { data, error } = await db
    .from("aiwebsite_domains")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update domain", error);
  return data;
}

export async function setDomainStatus(
  db: DbClient,
  id: string,
  status: DomainStatus
): Promise<void> {
  const patch: DomainUpdate = { status };
  if (status === "active") {
    patch.verified_at = new Date().toISOString();
    patch.ssl_active = true;
  }
  const { error } = await db.from("aiwebsite_domains").update(patch).eq("id", id);
  if (error) fail("Failed to update domain status", error);
}

export async function listDomainsBySite(db: DbClient, siteId: string): Promise<DomainRow[]> {
  const { data, error } = await db
    .from("aiwebsite_domains")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to list domains", error);
  return data ?? [];
}
