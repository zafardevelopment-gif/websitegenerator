import "server-only";

import type { DbClient, Json, SiteSectionRow } from "../types";
import { fail } from "./_helpers";

export async function listSiteSections(db: DbClient, siteId: string): Promise<SiteSectionRow[]> {
  const { data, error } = await db
    .from("aiwebsite_site_sections")
    .select("*")
    .eq("site_id", siteId)
    .order("section_key");
  if (error) fail("Failed to list site sections", error);
  return data ?? [];
}

export async function upsertSiteSection(
  db: DbClient,
  siteId: string,
  sectionKey: string,
  content: Json,
  options: { aiGenerated?: boolean; lastInstruction?: string | null; updatedBy?: string | null } = {}
): Promise<SiteSectionRow> {
  const { data, error } = await db
    .from("aiwebsite_site_sections")
    .upsert(
      {
        site_id: siteId,
        section_key: sectionKey,
        content,
        ai_generated: options.aiGenerated ?? false,
        last_instruction: options.lastInstruction ?? null,
        updated_by: options.updatedBy ?? null,
      },
      { onConflict: "site_id,section_key" }
    )
    .select("*")
    .single();
  if (error || !data) fail("Failed to save site section", error);
  return data;
}
