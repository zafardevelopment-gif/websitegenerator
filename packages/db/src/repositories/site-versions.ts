import "server-only";

import type { DbClient, Json, SiteVersionRow } from "../types";
import { fail } from "./_helpers";

/** Creates the next version snapshot and points the site at it. */
export async function createSiteVersion(
  db: DbClient,
  siteId: string,
  siteContent: Json,
  changeSummary: string | null,
  createdBy: string | null
): Promise<SiteVersionRow> {
  const { data: latest, error: latestError } = await db
    .from("aiwebsite_site_versions")
    .select("version_no")
    .eq("site_id", siteId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) fail("Failed to determine next version", latestError);

  const nextNo = (latest?.version_no ?? 0) + 1;
  const { data, error } = await db
    .from("aiwebsite_site_versions")
    .insert({
      site_id: siteId,
      version_no: nextNo,
      site_content: siteContent,
      change_summary: changeSummary,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error || !data) fail("Failed to create site version", error);

  const { error: pointerError } = await db
    .from("aiwebsite_sites")
    .update({ current_version_id: data.id })
    .eq("id", siteId);
  if (pointerError) fail("Failed to set current version", pointerError);

  return data;
}

export async function listSiteVersions(db: DbClient, siteId: string): Promise<SiteVersionRow[]> {
  const { data, error } = await db
    .from("aiwebsite_site_versions")
    .select("*")
    .eq("site_id", siteId)
    .order("version_no", { ascending: false });
  if (error) fail("Failed to list site versions", error);
  return data ?? [];
}

export async function getSiteVersion(db: DbClient, id: string): Promise<SiteVersionRow | null> {
  const { data, error } = await db
    .from("aiwebsite_site_versions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Failed to load site version", error);
  return data;
}

/** Rollback = point the site at an existing snapshot. */
export async function setCurrentVersion(
  db: DbClient,
  siteId: string,
  versionId: string
): Promise<void> {
  const { error } = await db
    .from("aiwebsite_sites")
    .update({ current_version_id: versionId })
    .eq("id", siteId);
  if (error) fail("Failed to roll back version", error);
}
