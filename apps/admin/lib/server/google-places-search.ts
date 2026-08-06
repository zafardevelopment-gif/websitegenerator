import "server-only";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

interface TextSearchResponse {
  status: string;
  error_message?: string;
  next_page_token?: string;
  results?: Array<{
    place_id: string;
    name: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
    business_status?: string;
    opening_hours?: { open_now?: boolean };
    geometry?: { location?: { lat: number; lng: number } };
  }>;
}

interface DetailsResponse {
  status: string;
  error_message?: string;
  result?: {
    place_id?: string;
    name?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    url?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  openNow: boolean | null;
  lat: number | null;
  lng: number | null;
  businessStatus: string | null;
}

export class PlacesApiError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = "PlacesApiError";
    this.retryable = retryable;
  }
}

export interface PlaceLeadDetails {
  placeId: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  googleMapsUrl: string | null;
  lat: number | null;
  lng: number | null;
}

async function getGooglePlacesKey(): Promise<string | null> {
  const db = createAdminSupabase();
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.googlePlacesApiKey).catch(() => null))
  );
}

/**
 * Text Search — one call per query string (e.g. "dentist in Karol Bagh,
 * Delhi"). Returns up to 20 results plus a token for the next page (Google
 * requires a short delay before that token becomes valid).
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function searchPlacesByText(
  query: string,
  pageToken?: string
): Promise<{ results: PlaceSearchResult[]; nextPageToken: string | null }> {
  const apiKey = await getGooglePlacesKey();
  if (!apiKey) throw new Error("Google Places API key not configured — add it in Settings.");

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  if (pageToken) {
    url.searchParams.set("pagetoken", pageToken);
  } else {
    url.searchParams.set("query", query);
  }
  url.searchParams.set("key", apiKey);

  // A fresh next_page_token isn't valid for a couple of seconds — Google
  // returns INVALID_REQUEST until it activates, so retry with backoff when
  // paginating instead of surfacing that as an error immediately.
  let payload: TextSearchResponse = { status: "UNKNOWN" };
  const attempts = pageToken ? 5 : 1;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(1500);
    const response = await fetch(url);
    payload = (await response.json().catch(() => ({ status: "UNKNOWN" }))) as TextSearchResponse;
    if (payload.status !== "INVALID_REQUEST") break;
  }

  if (payload.status === "ZERO_RESULTS") return { results: [], nextPageToken: null };
  if (payload.status === "INVALID_REQUEST" && pageToken) {
    // Surface Google's actual reason (if any) instead of guessing — this is
    // usually a timing issue, but can also mean the key/project setup
    // doesn't support pagination, which "wait and retry" can't fix.
    throw new PlacesApiError(
      payload.error_message
        ? `Google says: ${payload.error_message}`
        : "Google isn't returning the next page (INVALID_REQUEST) even after waiting.",
      true
    );
  }
  if (payload.status !== "OK") {
    throw new Error(payload.error_message || `Google Places error: ${payload.status}`);
  }

  const results: PlaceSearchResult[] = (payload.results ?? []).map((r) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address ?? null,
    rating: r.rating ?? null,
    reviewCount: r.user_ratings_total ?? null,
    types: r.types ?? [],
    openNow: r.opening_hours?.open_now ?? null,
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
    businessStatus: r.business_status ?? null,
  }));

  return { results, nextPageToken: payload.next_page_token ?? null };
}

export interface EnrichedPlaceResult extends PlaceSearchResult {
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      const item = items[i];
      if (item === undefined) continue;
      results[i] = await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Text Search + a Details call per result so the UI can filter/show phone
 * and website presence up front. Costs one Details call per result (bounded
 * to a single page, ≤20) — acceptable for the volumes this tool is used at.
 */
export async function searchPlacesWithDetails(
  query: string,
  pageToken?: string
): Promise<{ results: EnrichedPlaceResult[]; nextPageToken: string | null }> {
  const { results, nextPageToken } = await searchPlacesByText(query, pageToken);
  if (results.length === 0) return { results: [], nextPageToken };

  const detailed = await mapWithConcurrency(results, 5, async (place) => {
    const details = await getPlaceLeadDetails(place.placeId).catch(() => null);
    const enriched: EnrichedPlaceResult = {
      ...place,
      phone: details?.phone ?? null,
      website: details?.website ?? null,
      googleMapsUrl: details?.googleMapsUrl ?? null,
    };
    return enriched;
  });

  return { results: detailed, nextPageToken };
}

/** Place Details — only called for places the user chooses to import (keeps quota use low). */
export async function getPlaceLeadDetails(placeId: string): Promise<PlaceLeadDetails | null> {
  const apiKey = await getGooglePlacesKey();
  if (!apiKey) throw new Error("Google Places API key not configured — add it in Settings.");

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_phone_number,international_phone_number,website,formatted_address,rating,user_ratings_total,url,geometry"
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  const payload = (await response.json().catch(() => ({}))) as DetailsResponse;

  if (payload.status !== "OK" || !payload.result) return null;
  const r = payload.result;

  return {
    placeId: r.place_id ?? placeId,
    name: r.name ?? "Untitled business",
    phone: r.international_phone_number ?? r.formatted_phone_number ?? null,
    website: r.website ?? null,
    address: r.formatted_address ?? null,
    rating: r.rating ?? null,
    reviewCount: r.user_ratings_total ?? null,
    googleMapsUrl: r.url ?? null,
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
  };
}
