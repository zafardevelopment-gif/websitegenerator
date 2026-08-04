import "server-only";

import { createMediaAsset } from "@aiwebsite/db/repositories/media";
import type { DbClient, LeadRow } from "@aiwebsite/db/types";
import type { SiteContent } from "@aiwebsite/templates";

import { getCloudinaryConfig, uploadBufferToCloudinary } from "./cloudinary";
import { fetchPlacePhotoBytes, listPlacePhotos } from "./google-places";

const GALLERY_TARGET = 6;
const MAX_IMPORT = 8;

export interface FetchedGooglePhoto {
  url: string;
  alt: string;
}

export interface GooglePhotoFillResult {
  content: SiteContent;
  imported: number;
}

/**
 * Fetches the lead's real Google Business photos and uploads them to
 * Cloudinary once (call this a single time per generation, then apply the
 * result to as many language versions as needed via applyGooglePhotos).
 * Silently returns [] if a place_id, Google Places key, or Cloudinary isn't
 * configured — generation must never fail just because photos aren't available.
 */
export async function fetchAndUploadGooglePhotos(
  db: DbClient,
  lead: LeadRow,
  createdBy: string
): Promise<FetchedGooglePhoto[]> {
  if (!lead.place_id) return [];

  const cloudinary = await getCloudinaryConfig();
  if (!cloudinary) return [];

  const photos = await listPlacePhotos(lead.place_id).catch(() => null);
  if (!photos || photos.length === 0) return [];

  const uploaded: FetchedGooglePhoto[] = [];
  const alt = `${lead.business_name} photo`;

  for (const photo of photos.slice(0, MAX_IMPORT)) {
    const bytes = await fetchPlacePhotoBytes(photo.photoReference).catch(() => null);
    if (!bytes) continue;

    const result = await uploadBufferToCloudinary(
      cloudinary,
      bytes.buffer,
      bytes.contentType,
      `aiwebsite/leads/${lead.id}`
    );
    if (!result) continue;

    await createMediaAsset(db, {
      lead_id: lead.id,
      category: null,
      type: "gallery",
      file_name: null,
      storage_provider: "cloudinary",
      public_id: result.publicId,
      url: result.url,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
      alt_text: alt,
      is_stock: false,
      created_by: createdBy,
    }).catch(() => null);

    uploaded.push({ url: result.url, alt });
  }

  return uploaded;
}

/** Applies already-uploaded Google photos to a SiteContent's hero/gallery slots. */
export function applyGooglePhotos(
  content: SiteContent,
  photos: FetchedGooglePhoto[]
): GooglePhotoFillResult {
  if (photos.length === 0) return { content, imported: 0 };

  const next = structuredClone(content);
  let imported = 0;

  for (const photo of photos) {
    if (!next.hero.image?.url) {
      next.hero.image = { url: photo.url, alt: photo.alt };
      imported += 1;
      continue;
    }

    const existingGallery = next.gallery.images.filter((image) => image.url);
    if (existingGallery.length < GALLERY_TARGET) {
      existingGallery.push({ url: photo.url, alt: photo.alt });
      next.gallery = { ...next.gallery, images: existingGallery };
      imported += 1;
    }
  }

  return { content: next, imported };
}
