import "server-only";

import type { ClientRow, Database, DbClient } from "../types";
import { fail } from "./_helpers";

type ClientInsert = Database["public"]["Tables"]["aiwebsite_clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["aiwebsite_clients"]["Update"];

export async function createClient(db: DbClient, input: ClientInsert): Promise<ClientRow> {
  const { data, error } = await db.from("aiwebsite_clients").insert(input).select("*").single();
  if (error || !data) fail("Failed to create client", error);
  return data;
}

export async function updateClient(
  db: DbClient,
  id: string,
  patch: ClientUpdate
): Promise<ClientRow> {
  const { data, error } = await db
    .from("aiwebsite_clients")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update client", error);
  return data;
}

export async function listClients(db: DbClient): Promise<ClientRow[]> {
  const { data, error } = await db
    .from("aiwebsite_clients")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to list clients", error);
  return data ?? [];
}

export async function getClientByLead(db: DbClient, leadId: string): Promise<ClientRow | null> {
  const { data, error } = await db
    .from("aiwebsite_clients")
    .select("*")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) fail("Failed to load client", error);
  return data;
}

/** Clients whose domain or renewal falls within the reminder window. */
export async function listUpcomingRenewals(db: DbClient, withinDays: number): Promise<ClientRow[]> {
  const cutoff = new Date(Date.now() + withinDays * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("aiwebsite_clients")
    .select("*")
    .is("deleted_at", null)
    .eq("is_active", true)
    .or(`domain_expiry.lte.${cutoff},renewal_date.lte.${cutoff}`)
    .order("domain_expiry", { ascending: true });
  if (error) fail("Failed to list renewals", error);
  return data ?? [];
}
