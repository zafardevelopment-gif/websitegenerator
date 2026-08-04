import "server-only";

import type { Database, DbClient, TemplateRow } from "../types";
import { fail } from "./_helpers";

type TemplateInsert = Database["public"]["Tables"]["aiwebsite_templates"]["Insert"];
type TemplateUpdate = Database["public"]["Tables"]["aiwebsite_templates"]["Update"];

export async function listTemplates(db: DbClient, onlyActive = true): Promise<TemplateRow[]> {
  let query = db.from("aiwebsite_templates").select("*").order("sort_order");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) fail("Failed to list templates", error);
  return data ?? [];
}

export async function getTemplateByKey(db: DbClient, key: string): Promise<TemplateRow | null> {
  const { data, error } = await db
    .from("aiwebsite_templates")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error) fail("Failed to load template", error);
  return data;
}

export async function createTemplate(db: DbClient, input: TemplateInsert): Promise<TemplateRow> {
  const { data, error } = await db
    .from("aiwebsite_templates")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to create template", error);
  return data;
}

export async function updateTemplate(
  db: DbClient,
  id: string,
  patch: TemplateUpdate
): Promise<TemplateRow> {
  const { data, error } = await db
    .from("aiwebsite_templates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update template", error);
  return data;
}
