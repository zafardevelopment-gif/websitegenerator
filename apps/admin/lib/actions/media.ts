"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BUSINESS_CATEGORIES } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import {
  createMediaAsset,
  getMediaAsset,
  softDeleteMediaAsset,
} from "@aiwebsite/db/repositories/media";
import { getSite } from "@aiwebsite/db/repositories/sites";
import { getLead } from "@aiwebsite/db/repositories/leads";
import type { Json } from "@aiwebsite/db/types";
import { parseSiteContent } from "@aiwebsite/templates";

import {
  destroyCloudinaryAsset,
  getCloudinaryConfig,
  signCloudinaryParams,
  uploadBufferToCloudinary,
} from "../server/cloudinary";
import { fetchPlacePhotoBytes, listPlacePhotos } from "../server/google-places";
import { fillContentImages } from "../server/stock-fill";

export type MediaActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string };

const MEDIA_TYPES = ["logo", "hero", "gallery", "team", "certificate", "video", "other"] as const;

function friendly(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) return "You don't have permission for that.";
  return message;
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

// ── Signed upload ────────────────────────────────────────────────────

const signatureSchema = z.object({
  leadId: z.string().uuid().nullable(),
  isStock: z.boolean(),
  category: z.string().max(80),
});

export interface UploadTicket {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/** Mints a short-lived signature for a direct browser → Cloudinary upload. */
export async function getUploadTicketAction(
  input: unknown
): Promise<MediaActionResult<UploadTicket>> {
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request" };

  try {
    await requireUser();
    const config = await getCloudinaryConfig();
    if (!config) {
      return {
        ok: false,
        error:
          "Cloudinary is not configured. Add cloud name, API key and API secret in Settings → API Keys.",
      };
    }

    const folder = parsed.data.isStock
      ? `aiwebsite/stock/${(parsed.data.category || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      : `aiwebsite/leads/${parsed.data.leadId ?? "unassigned"}`;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signCloudinaryParams({ folder, timestamp }, config.apiSecret);

    return {
      ok: true,
      message: "ok",
      data: { cloudName: config.cloudName, apiKey: config.apiKey, timestamp, signature, folder },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Register the uploaded asset ─────────────────────────────────────

const registerSchema = z.object({
  leadId: z.string().uuid().nullable(),
  isStock: z.boolean(),
  category: z.string().max(80),
  type: z.enum(MEDIA_TYPES),
  fileName: z.string().max(200),
  publicId: z.string().min(1).max(300),
  url: z.string().url(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  bytes: z.number().int().nullable(),
  format: z.string().max(20).nullable(),
});

export async function registerMediaAction(input: unknown): Promise<MediaActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid asset payload" };

  try {
    const { supabase, user } = await requireUser();
    const category = parsed.data.isStock
      ? (BUSINESS_CATEGORIES as readonly string[]).includes(parsed.data.category)
        ? parsed.data.category
        : "General Business"
      : null;

    await createMediaAsset(supabase, {
      lead_id: parsed.data.isStock ? null : parsed.data.leadId,
      category,
      type: parsed.data.type,
      file_name: parsed.data.fileName || null,
      storage_provider: "cloudinary",
      public_id: parsed.data.publicId,
      url: parsed.data.url,
      width: parsed.data.width,
      height: parsed.data.height,
      bytes: parsed.data.bytes,
      format: parsed.data.format,
      alt_text: null,
      is_stock: parsed.data.isStock,
      created_by: user.id,
    });
    revalidatePath("/media");
    return { ok: true, message: "Asset saved." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Delete ──────────────────────────────────────────────────────────

export async function deleteMediaAction(id: unknown): Promise<MediaActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid asset id" };

  try {
    const { supabase } = await requireUser();
    const asset = await getMediaAsset(supabase, parsed.data);
    if (!asset) return { ok: false, error: "Asset not found" };

    await softDeleteMediaAsset(supabase, parsed.data);

    // Best-effort removal from Cloudinary too.
    if (asset.storage_provider === "cloudinary" && asset.public_id) {
      const config = await getCloudinaryConfig();
      if (config) {
        await destroyCloudinaryAsset(
          config,
          asset.public_id,
          asset.format === "mp4" ? "video" : "image"
        );
      }
    }
    revalidatePath("/media");
    return { ok: true, message: "Asset deleted." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Stock auto-fill (editor button) ─────────────────────────────────

const autoFillSchema = z.object({
  siteId: z.string().uuid(),
  content: z.unknown(),
});

export async function autoFillImagesAction(
  input: unknown
): Promise<MediaActionResult<{ content: Json; filled: number }>> {
  const parsed = autoFillSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const content = parseSiteContent(parsed.data.content);
  if (!content) return { ok: false, error: "Draft content is invalid — save first." };

  try {
    const { supabase } = await requireUser();
    const site = await getSite(supabase, parsed.data.siteId);
    if (!site) return { ok: false, error: "Site not found" };
    const lead = await getLead(supabase, site.lead_id);

    const result = await fillContentImages(supabase, content, lead?.category ?? null);
    if (result.filled === 0) {
      return {
        ok: false,
        error:
          "No stock images available for this category — upload some in Media → Stock library.",
      };
    }
    return {
      ok: true,
      message: `Filled ${result.filled} image slot${result.filled === 1 ? "" : "s"} from stock.`,
      data: { content: result.content as unknown as Json, filled: result.filled },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Google Places photos ─────────────────────────────────────────────

export interface GooglePlacePhotoHit {
  photoReference: string;
  width: number;
  height: number;
  previewUrl: string;
}

/** Lists a lead's Google Business photos for the picker dialog. */
export async function listGooglePlacePhotosAction(
  leadId: unknown
): Promise<MediaActionResult<GooglePlacePhotoHit[]>> {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return { ok: false, error: "Invalid lead id" };

  try {
    const { supabase } = await requireUser();
    const lead = await getLead(supabase, parsed.data);
    if (!lead) return { ok: false, error: "Lead not found" };
    if (!lead.place_id) {
      return { ok: false, error: "This lead has no Google Place ID — add it in the lead's Google info." };
    }

    const photos = await listPlacePhotos(lead.place_id);
    if (photos === null) {
      return {
        ok: false,
        error: "Google Places is not configured. Add an API key in Settings → API Keys.",
      };
    }
    if (photos.length === 0) {
      return { ok: false, error: "No photos found on this business's Google listing." };
    }
    return { ok: true, message: "ok", data: photos };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

const importGooglePhotosSchema = z.object({
  leadId: z.string().uuid(),
  photoReferences: z.array(z.string().min(1)).min(1).max(12),
});

/** Fetches selected Google photos server-side and re-uploads them to Cloudinary. */
export async function importGooglePlacePhotosAction(
  input: unknown
): Promise<MediaActionResult<{ imported: number }>> {
  const parsed = importGooglePhotosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const { supabase, user } = await requireUser();
    const lead = await getLead(supabase, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found" };

    const cloudinary = await getCloudinaryConfig();
    if (!cloudinary) {
      return {
        ok: false,
        error: "Cloudinary is not configured. Add it in Settings → API Keys.",
      };
    }

    let imported = 0;
    for (const photoReference of parsed.data.photoReferences) {
      const photo = await fetchPlacePhotoBytes(photoReference);
      if (!photo) continue;

      const uploaded = await uploadBufferToCloudinary(
        cloudinary,
        photo.buffer,
        photo.contentType,
        `aiwebsite/leads/${lead.id}`
      );
      if (!uploaded) continue;

      await createMediaAsset(supabase, {
        lead_id: lead.id,
        category: null,
        type: "gallery",
        file_name: null,
        storage_provider: "cloudinary",
        public_id: uploaded.publicId,
        url: uploaded.url,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
        format: uploaded.format,
        alt_text: `${lead.business_name} photo`,
        is_stock: false,
        created_by: user.id,
      });
      imported += 1;
    }

    if (imported === 0) {
      return { ok: false, error: "Couldn't import any of the selected photos — try again." };
    }

    revalidatePath("/media");
    revalidatePath(`/leads/${lead.id}`);
    return {
      ok: true,
      message: `Imported ${imported} photo${imported === 1 ? "" : "s"} from Google.`,
      data: { imported },
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
