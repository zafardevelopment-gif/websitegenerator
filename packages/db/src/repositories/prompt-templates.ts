import "server-only";

import type { Database, DbClient, PromptTemplateRow } from "../types";
import { fail } from "./_helpers";

type PromptInsert = Database["public"]["Tables"]["aiwebsite_prompt_templates"]["Insert"];

/** Highest active version for a key (optionally category-specific first). */
export async function getActivePrompt(
  db: DbClient,
  key: string
): Promise<PromptTemplateRow | null> {
  const { data, error } = await db
    .from("aiwebsite_prompt_templates")
    .select("*")
    .eq("key", key)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Failed to load prompt template", error);
  return data;
}

export async function listPromptTemplates(db: DbClient): Promise<PromptTemplateRow[]> {
  const { data, error } = await db
    .from("aiwebsite_prompt_templates")
    .select("*")
    .order("key")
    .order("version", { ascending: false });
  if (error) fail("Failed to list prompt templates", error);
  return data ?? [];
}

/** Editing a prompt creates a new version and deactivates the old one. */
export async function createPromptVersion(
  db: DbClient,
  input: Omit<PromptInsert, "version" | "parent_id">
): Promise<PromptTemplateRow> {
  const current = await getActivePrompt(db, input.key);

  const { data, error } = await db
    .from("aiwebsite_prompt_templates")
    .insert({
      ...input,
      version: (current?.version ?? 0) + 1,
      parent_id: current?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) fail("Failed to create prompt version", error);

  if (current) {
    const { error: deactivateError } = await db
      .from("aiwebsite_prompt_templates")
      .update({ is_active: false })
      .eq("id", current.id);
    if (deactivateError) fail("Failed to deactivate old prompt version", deactivateError);
  }
  return data;
}
