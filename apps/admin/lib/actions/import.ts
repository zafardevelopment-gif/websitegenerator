"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  computeLeadScore,
  normalizeScoringWeights,
  SETTING_KEYS,
} from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getJsonSetting } from "@aiwebsite/db/settings";
import { createImport, updateImport } from "@aiwebsite/db/repositories/imports";
import { bulkInsertLeads, getDedupeKeys } from "@aiwebsite/db/repositories/leads";
import type { Database, Json, Priority } from "@aiwebsite/db/types";

import { IMPORT_FIELD_KEYS } from "../import-mapping";

type LeadInsert = Database["public"]["Tables"]["aiwebsite_leads"]["Insert"];

const MAX_ROWS = 2000;

const importInputSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mapping: z.record(z.string(), z.string()),
  options: z.object({
    skipDuplicates: z.boolean(),
    defaultSource: z.string().trim().max(120),
    defaultTags: z.string().trim().max(500),
  }),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, "The file has no data rows")
    .max(MAX_ROWS, `Import at most ${MAX_ROWS} rows at a time`),
});

export interface ImportRowIssue {
  row: number; // 1-based data row number
  reason: string;
}

export type ImportResult =
  | {
      ok: true;
      importId: string;
      imported: number;
      duplicates: number;
      skipped: number;
      issues: ImportRowIssue[];
    }
  | { ok: false; error: string };

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const num = (v: unknown): number | null => {
  const s = str(v);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const list = (v: unknown): string[] =>
  str(v)
    ?.split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const normalizePhoneKey = (phone: string | null): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
};

export async function runImportAction(input: unknown): Promise<ImportResult> {
  const parsed = importInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid import payload" };
  }
  const { fileName, mapping, options, rows } = parsed.data;

  // Only known target fields count; everything else stays in raw_import.
  const activeMapping = Object.entries(mapping).filter(
    ([, target]) => target && IMPORT_FIELD_KEYS.includes(target)
  ) as [string, string][];
  if (!activeMapping.some(([, target]) => target === "business_name")) {
    return { ok: false, error: "Map a column to Business name first." };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let importId: string;
  try {
    const batch = await createImport(supabase, {
      file_name: fileName,
      column_mapping: mapping as unknown as Json,
      status: "processing",
      total_rows: rows.length,
      created_by: user.id,
    });
    importId = batch.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to start import" };
  }

  try {
    const weights = normalizeScoringWeights(
      await getJsonSetting(supabase, SETTING_KEYS.scoringWeights)
    );
    const { phones: existingPhones, placeIds: existingPlaceIds } = await getDedupeKeys(supabase);
    const seenPhones = new Set<string>();
    const seenPlaceIds = new Set<string>();

    const defaultTags = list(options.defaultTags).map((t) =>
      t.toLowerCase().replace(/\s+/g, "-")
    );

    const inserts: LeadInsert[] = [];
    const issues: ImportRowIssue[] = [];
    let duplicates = 0;

    rows.forEach((raw, index) => {
      const rowNo = index + 1;
      // Apply mapping → field values.
      const value: Record<string, unknown> = {};
      for (const [source, target] of activeMapping) {
        value[target] = raw[source];
      }

      const businessName = str(value.business_name);
      if (!businessName) {
        issues.push({ row: rowNo, reason: "Missing business name — skipped" });
        return;
      }

      const phone = str(value.phone);
      const placeId = str(value.place_id);
      const phoneKey = normalizePhoneKey(phone);

      const isDuplicate =
        (phoneKey !== null && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey))) ||
        (placeId !== null && (existingPlaceIds.has(placeId) || seenPlaceIds.has(placeId)));
      if (isDuplicate) {
        duplicates += 1;
        if (options.skipDuplicates) {
          issues.push({ row: rowNo, reason: `Duplicate (${businessName}) — skipped` });
          return;
        }
      }
      if (phoneKey) seenPhones.add(phoneKey);
      if (placeId) seenPlaceIds.add(placeId);

      const rating = num(value.google_rating);
      const googleRating = rating !== null && rating >= 0 && rating <= 5 ? rating : null;
      if (rating !== null && googleRating === null) {
        issues.push({ row: rowNo, reason: "Rating outside 0–5 — stored empty" });
      }
      const reviewCount = num(value.review_count);
      const website = str(value.website);
      const category = str(value.category);
      const priorityRaw = str(value.priority)?.toLowerCase();
      const priority: Priority = ["high", "medium", "low"].includes(priorityRaw ?? "")
        ? (priorityRaw as Priority)
        : "medium";

      inserts.push({
        business_name: businessName,
        category,
        owner_name: str(value.owner_name),
        phone,
        whatsapp: str(value.whatsapp) ?? phone,
        email: str(value.email),
        website,
        instagram: str(value.instagram),
        facebook: str(value.facebook),
        linkedin: str(value.linkedin),
        google_rating: googleRating,
        review_count: reviewCount !== null ? Math.max(0, Math.round(reviewCount)) : null,
        address: str(value.address),
        area: str(value.area),
        city: str(value.city),
        state: str(value.state),
        country: str(value.country) ?? "India",
        pincode: str(value.pincode),
        latitude: num(value.latitude),
        longitude: num(value.longitude),
        google_maps_url: str(value.google_maps_url),
        place_id: placeId,
        business_description: str(value.business_description),
        services: list(value.services),
        notes: str(value.notes),
        lead_source: str(value.lead_source) ?? (options.defaultSource || "import"),
        tags: Array.from(new Set([...list(value.tags).map((t) => t.toLowerCase()), ...defaultTags])),
        priority,
        lead_score: computeLeadScore(
          {
            googleRating,
            reviewCount,
            hasWebsite: website !== null,
            category,
          },
          weights
        ),
        raw_import: raw as Json,
        import_id: importId,
        created_by: user.id,
      });
    });

    const imported = inserts.length > 0 ? await bulkInsertLeads(supabase, inserts) : 0;
    const skipped = rows.length - imported;

    await updateImport(supabase, importId, {
      status: "completed",
      imported_rows: imported,
      skipped_rows: skipped,
      duplicate_rows: duplicates,
      error_report: issues.slice(0, 200) as unknown as Json,
      completed_at: new Date().toISOString(),
    });

    revalidatePath("/leads");
    revalidatePath("/leads/import");
    return { ok: true, importId, imported, duplicates, skipped, issues: issues.slice(0, 50) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    await updateImport(supabase, importId, {
      status: "failed",
      error_report: [{ row: 0, reason: message }] as unknown as Json,
      completed_at: new Date().toISOString(),
    }).catch(() => undefined);
    return { ok: false, error: message };
  }
}
