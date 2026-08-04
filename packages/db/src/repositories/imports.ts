import "server-only";

import type { Database, DbClient, LeadImportRow } from "../types";
import { fail } from "./_helpers";

type ImportInsert = Database["public"]["Tables"]["aiwebsite_lead_imports"]["Insert"];
type ImportUpdate = Database["public"]["Tables"]["aiwebsite_lead_imports"]["Update"];

export async function createImport(db: DbClient, input: ImportInsert): Promise<LeadImportRow> {
  const { data, error } = await db
    .from("aiwebsite_lead_imports")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to create import batch", error);
  return data;
}

export async function updateImport(
  db: DbClient,
  id: string,
  patch: ImportUpdate
): Promise<LeadImportRow> {
  const { data, error } = await db
    .from("aiwebsite_lead_imports")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update import batch", error);
  return data;
}

export async function listImports(db: DbClient, limit = 50): Promise<LeadImportRow[]> {
  const { data, error } = await db
    .from("aiwebsite_lead_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list imports", error);
  return data ?? [];
}
