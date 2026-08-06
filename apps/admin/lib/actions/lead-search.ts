"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { computeLeadScore, normalizeScoringWeights, SETTING_KEYS } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getJsonSetting } from "@aiwebsite/db/settings";
import { bulkInsertLeads, getDedupeKeys } from "@aiwebsite/db/repositories/leads";
import type { Database } from "@aiwebsite/db/types";

import { searchPlacesWithDetails, type EnrichedPlaceResult } from "../server/google-places-search";

type LeadInsert = Database["public"]["Tables"]["aiwebsite_leads"]["Insert"];

function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) return "You don't have permission for that.";
  return message;
}

// ── Search ───────────────────────────────────────────────────────────

const searchSchema = z.object({
  query: z.string().trim().min(2).max(200),
  pageToken: z.string().trim().max(2000).optional(),
});

export interface PlaceSearchHit extends EnrichedPlaceResult {
  /** True when this business is already a lead (matched by place ID or phone) — cannot be re-imported. */
  alreadyInCrm: boolean;
}

export type SearchGooglePlacesResult =
  | { ok: true; results: PlaceSearchHit[]; nextPageToken: string | null }
  | { ok: false; error: string; retryable?: boolean };

/**
 * Text-searches Google Places and enriches each hit with phone/website, so
 * the UI can filter by them — and flags any hit that's already a lead
 * (by place ID or phone number) so it can't be selected for import.
 */
export async function searchGooglePlacesAction(input: unknown): Promise<SearchGooglePlacesResult> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a search term first." };

  try {
    const [{ results, nextPageToken }, supabase] = await Promise.all([
      searchPlacesWithDetails(parsed.data.query, parsed.data.pageToken),
      createServerSupabase(),
    ]);
    const { phones: existingPhones, placeIds: existingPlaceIds } = await getDedupeKeys(supabase);

    const flagged: PlaceSearchHit[] = results.map((r) => {
      const phoneKey = r.phone ? r.phone.replace(/[^0-9]/g, "").slice(-10) : null;
      const alreadyInCrm =
        existingPlaceIds.has(r.placeId) || (phoneKey !== null && existingPhones.has(phoneKey));
      return { ...r, alreadyInCrm };
    });

    return { ok: true, results: flagged, nextPageToken };
  } catch (e) {
    // Google's next_page_token isn't valid for a few seconds after it's
    // issued — our own retry loop already waited ~6s; if it's still not
    // ready, tell the client to keep retrying instead of showing an error.
    if (e instanceof Error && e.message === "RETRYABLE_PAGE_TOKEN") {
      return {
        ok: false,
        error: "Still preparing the next page…",
        retryable: true,
      };
    }
    return { ok: false, error: friendlyError(e) };
  }
}

// ── Import selected results ─────────────────────────────────────────
// Takes the already-fetched result objects from the client, rather than
// re-hitting the Places API — the search step already paid for those calls.

const importPlaceSchema = z.object({
  placeId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(30).nullable(),
  website: z.string().trim().max(500).nullable(),
  address: z.string().trim().max(500).nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).nullable(),
  googleMapsUrl: z.string().trim().max(500).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

const importSchema = z.object({
  places: z.array(importPlaceSchema).min(1).max(60),
  category: z.string().trim().max(80).optional(),
  defaultTags: z.string().trim().max(500).optional(),
});

export type ImportGooglePlacesResult =
  | { ok: true; message: string; imported: number; duplicates: number }
  | { ok: false; error: string };

export async function importGooglePlacesAction(input: unknown): Promise<ImportGooglePlacesResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const weights = normalizeScoringWeights(
      await getJsonSetting(supabase, SETTING_KEYS.scoringWeights)
    );
    const { phones: existingPhones, placeIds: existingPlaceIds } = await getDedupeKeys(supabase);
    const seenPhones = new Set<string>();

    const defaultTags = parsed.data.defaultTags
      ? parsed.data.defaultTags
          .split(/[,;|]/)
          .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
          .filter(Boolean)
      : [];
    const category = parsed.data.category ?? null;

    const inserts: LeadInsert[] = [];
    let duplicates = 0;

    for (const p of parsed.data.places) {
      if (existingPlaceIds.has(p.placeId)) {
        duplicates += 1;
        continue;
      }
      const phoneKey = p.phone ? p.phone.replace(/[^0-9]/g, "").slice(-10) : null;
      if (phoneKey && (existingPhones.has(phoneKey) || seenPhones.has(phoneKey))) {
        duplicates += 1;
        continue;
      }
      if (phoneKey) seenPhones.add(phoneKey);

      inserts.push({
        business_name: p.name,
        category,
        phone: p.phone,
        whatsapp: p.phone,
        website: p.website,
        google_rating: p.rating,
        review_count: p.reviewCount,
        address: p.address,
        latitude: p.lat,
        longitude: p.lng,
        google_maps_url: p.googleMapsUrl,
        place_id: p.placeId,
        country: "India",
        lead_source: "google_places",
        tags: defaultTags,
        priority: "medium",
        lead_score: computeLeadScore(
          {
            googleRating: p.rating,
            reviewCount: p.reviewCount,
            hasWebsite: p.website !== null,
            category,
          },
          weights
        ),
        created_by: user.id,
      });
    }

    const imported = inserts.length > 0 ? await bulkInsertLeads(supabase, inserts) : 0;

    revalidatePath("/leads");
    revalidatePath("/leads/find");

    return {
      ok: true,
      message: `Imported ${imported} lead${imported === 1 ? "" : "s"}${
        duplicates ? ` — ${duplicates} already existed` : ""
      }.`,
      imported,
      duplicates,
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
