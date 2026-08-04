import "server-only";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getDecryptedSetting } from "@aiwebsite/db/settings";

const MAX_PHOTOS = 12;
const PHOTO_MAX_WIDTH = 1280;

interface PlaceDetailsResponse {
  status: string;
  error_message?: string;
  result?: {
    photos?: { photo_reference: string; width: number; height: number }[];
  };
}

export interface GooglePlacePhoto {
  photoReference: string;
  width: number;
  height: number;
  /** Proxy URL — the app's own route, never exposes the API key to the browser. */
  previewUrl: string;
}

async function getGooglePlacesKey(): Promise<string | null> {
  const db = createAdminSupabase();
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    (await getDecryptedSetting(db, SETTING_KEYS.googlePlacesApiKey).catch(() => null))
  );
}

/** Lists up to 12 photo references for a Google Place. Null = not configured. */
export async function listPlacePhotos(placeId: string): Promise<GooglePlacePhoto[] | null> {
  const apiKey = await getGooglePlacesKey();
  if (!apiKey) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "photos");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  const payload = (await response.json().catch(() => ({}))) as PlaceDetailsResponse;

  if (payload.status !== "OK") {
    throw new Error(payload.error_message || `Google Places error: ${payload.status}`);
  }

  const photos = payload.result?.photos ?? [];
  return photos.slice(0, MAX_PHOTOS).map((photo) => ({
    photoReference: photo.photo_reference,
    width: photo.width,
    height: photo.height,
    previewUrl: `/api/google-places/photo?ref=${encodeURIComponent(photo.photo_reference)}`,
  }));
}

/** Fetches one photo's binary from Google — server-side only (keeps the API key private). */
export async function fetchPlacePhotoBytes(
  photoReference: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const apiKey = await getGooglePlacesKey();
  if (!apiKey) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("photo_reference", photoReference);
  url.searchParams.set("maxwidth", String(PHOTO_MAX_WIDTH));
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) return null;

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") ?? "image/jpeg",
  };
}
