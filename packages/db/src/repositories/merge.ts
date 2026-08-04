import "server-only";

import type { Database, DbClient, LeadRow } from "../types";
import { fail } from "./_helpers";
import { logLeadActivity } from "./leads";

type LeadUpdate = Database["public"]["Tables"]["aiwebsite_leads"]["Update"];

export interface DuplicateGroup {
  /** "phone:9810000001" or "place:ChIJ..." */
  key: string;
  leads: LeadRow[];
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits || null;
}

/** Groups active leads sharing a phone number or Google place_id. */
export async function findDuplicateGroups(db: DbClient, limit = 5000): Promise<DuplicateGroup[]> {
  const { data, error } = await db
    .from("aiwebsite_leads")
    .select("*")
    .is("deleted_at", null)
    .limit(limit);
  if (error) fail("Failed to scan for duplicates", error);

  const byKey = new Map<string, LeadRow[]>();
  for (const lead of data ?? []) {
    const keys: string[] = [];
    const phone = normalizePhone(lead.phone);
    if (phone) keys.push(`phone:${phone}`);
    if (lead.place_id) keys.push(`place:${lead.place_id}`);
    for (const key of keys) {
      const group = byKey.get(key) ?? [];
      group.push(lead);
      byKey.set(key, group);
    }
  }

  const groups: DuplicateGroup[] = [];
  const seenPairs = new Set<string>();
  for (const [key, leads] of byKey) {
    if (leads.length < 2) continue;
    const pairKey = leads
      .map((l) => l.id)
      .sort()
      .join("|");
    if (seenPairs.has(pairKey)) continue; // same pair matched by both phone AND place
    seenPairs.add(pairKey);
    groups.push({ key, leads });
  }
  return groups.sort((a, b) => b.leads.length - a.leads.length);
}

/** Column names a merge may copy from the duplicate onto the primary. */
export const MERGEABLE_FIELDS = [
  "business_name", "category", "owner_name", "phone", "whatsapp", "email",
  "website", "instagram", "facebook", "linkedin", "google_rating",
  "review_count", "address", "area", "city", "state", "pincode",
  "google_maps_url", "place_id", "business_description", "lead_source",
  "notes",
] as const;
export type MergeableField = (typeof MERGEABLE_FIELDS)[number];

/**
 * Merges `duplicateId` into `primaryId`:
 *  - copies the selected field values onto the primary
 *  - unions tags
 *  - re-parents activities, follow-ups, sites, messages, media, quotations
 *  - soft-deletes the duplicate and logs the merge on the primary timeline
 */
export async function mergeLeads(
  db: DbClient,
  primaryId: string,
  duplicateId: string,
  fieldChoices: Partial<Record<MergeableField, "primary" | "duplicate">>,
  actorId: string
): Promise<void> {
  const { data: leads, error } = await db
    .from("aiwebsite_leads")
    .select("*")
    .in("id", [primaryId, duplicateId]);
  if (error) fail("Failed to load leads for merge", error);
  const primary = leads?.find((l) => l.id === primaryId);
  const duplicate = leads?.find((l) => l.id === duplicateId);
  if (!primary || !duplicate) throw new Error("One of the leads no longer exists.");

  const patch: LeadUpdate = {};
  const writable = patch as Record<MergeableField, LeadRow[MergeableField]>;
  for (const field of MERGEABLE_FIELDS) {
    const choice = fieldChoices[field];
    if (choice === "duplicate") {
      writable[field] = duplicate[field];
    } else if (choice === undefined && primary[field] === null && duplicate[field] !== null) {
      // default: fill gaps in the primary from the duplicate
      writable[field] = duplicate[field];
    }
  }
  patch.tags = Array.from(new Set([...primary.tags, ...duplicate.tags]));

  const { error: updateError } = await db
    .from("aiwebsite_leads")
    .update(patch)
    .eq("id", primaryId);
  if (updateError) fail("Failed to update primary lead", updateError);

  // Re-parent children (written out per table to keep full type safety).
  const moves = [
    db.from("aiwebsite_lead_activities").update({ lead_id: primaryId }).eq("lead_id", duplicateId),
    db.from("aiwebsite_follow_ups").update({ lead_id: primaryId }).eq("lead_id", duplicateId),
    db.from("aiwebsite_sites").update({ lead_id: primaryId }).eq("lead_id", duplicateId),
    db.from("aiwebsite_messages").update({ lead_id: primaryId }).eq("lead_id", duplicateId),
    db.from("aiwebsite_media_assets").update({ lead_id: primaryId }).eq("lead_id", duplicateId),
    db.from("aiwebsite_quotations").update({ lead_id: primaryId }).eq("lead_id", duplicateId),
    db.from("aiwebsite_payments").update({ lead_id: primaryId }).eq("lead_id", duplicateId),
  ];
  for (const move of moves) {
    const { error: reparentError } = await move;
    if (reparentError) fail("Failed to move related records during merge", reparentError);
  }

  const { error: deleteError } = await db
    .from("aiwebsite_leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", duplicateId);
  if (deleteError) fail("Failed to archive duplicate lead", deleteError);

  await logLeadActivity(
    db,
    primaryId,
    "system",
    `Merged duplicate "${duplicate.business_name}" into this lead`,
    { duplicate_id: duplicateId },
    actorId
  );
}
