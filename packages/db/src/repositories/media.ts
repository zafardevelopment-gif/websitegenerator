import "server-only";

import type { Database, DbClient, MediaAssetRow } from "../types";
import { fail } from "./_helpers";

type MediaInsert = Database["public"]["Tables"]["aiwebsite_media_assets"]["Insert"];
type MediaUpdate = Database["public"]["Tables"]["aiwebsite_media_assets"]["Update"];

export async function createMediaAsset(db: DbClient, input: MediaInsert): Promise<MediaAssetRow> {
  const { data, error } = await db
    .from("aiwebsite_media_assets")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) fail("Failed to save media asset", error);
  return data;
}

export async function listMediaByLead(db: DbClient, leadId: string): Promise<MediaAssetRow[]> {
  const { data, error } = await db
    .from("aiwebsite_media_assets")
    .select("*")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) fail("Failed to list media", error);
  return data ?? [];
}

export async function updateMediaAsset(
  db: DbClient,
  id: string,
  patch: MediaUpdate
): Promise<MediaAssetRow> {
  const { data, error } = await db
    .from("aiwebsite_media_assets")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) fail("Failed to update media asset", error);
  return data;
}

/** Most recent non-stock uploads across all leads. */
export async function listRecentMedia(db: DbClient, limit = 100): Promise<MediaAssetRow[]> {
  const { data, error } = await db
    .from("aiwebsite_media_assets")
    .select("*")
    .eq("is_stock", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("Failed to list media", error);
  return data ?? [];
}

/** All active stock assets (optionally one category's pool). */
export async function listStockAssets(
  db: DbClient,
  category?: string | null
): Promise<MediaAssetRow[]> {
  let query = db
    .from("aiwebsite_media_assets")
    .select("*")
    .eq("is_stock", true)
    .is("deleted_at", null);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) fail("Failed to list stock assets", error);
  return data ?? [];
}

export async function getMediaAsset(db: DbClient, id: string): Promise<MediaAssetRow | null> {
  const { data, error } = await db
    .from("aiwebsite_media_assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Failed to load media asset", error);
  return data;
}

export async function softDeleteMediaAsset(db: DbClient, id: string): Promise<void> {
  const { error } = await db
    .from("aiwebsite_media_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("Failed to delete media asset", error);
}
