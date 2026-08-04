import "server-only";

import { listStockAssets } from "@aiwebsite/db/repositories/media";
import type { DbClient, MediaAssetRow } from "@aiwebsite/db/types";
import type { SiteContent } from "@aiwebsite/templates";

const GALLERY_TARGET = 6;

/** Category pool → General Business pool → any stock. */
async function stockPool(db: DbClient, category: string | null): Promise<MediaAssetRow[]> {
  if (category) {
    const exact = await listStockAssets(db, category);
    if (exact.length > 0) return exact;
  }
  const general = await listStockAssets(db, "General Business");
  if (general.length > 0) return general;
  return listStockAssets(db);
}

export interface StockFillResult {
  content: SiteContent;
  filled: number;
}

/**
 * Fills empty image slots (hero, about, gallery) from the stock pool so a
 * demo never ships without images. Existing images are left untouched.
 */
export async function fillContentImages(
  db: DbClient,
  content: SiteContent,
  category: string | null
): Promise<StockFillResult> {
  const pool = (await stockPool(db, category)).filter(
    (asset) => asset.type !== "logo" && asset.format !== "mp4"
  );
  if (pool.length === 0) return { content, filled: 0 };

  const used = new Set<string>(
    [content.hero.image?.url, content.about.image?.url, ...content.gallery.images.map((i) => i.url)]
      .filter(Boolean) as string[]
  );
  const queue = pool.filter((asset) => !used.has(asset.url));
  let filled = 0;

  /** Prefer a specific asset type; fall back to the next available. */
  const take = (preferType?: MediaAssetRow["type"]): MediaAssetRow | undefined => {
    let index = preferType ? queue.findIndex((a) => a.type === preferType) : -1;
    if (index === -1 && queue.length > 0) index = 0;
    if (index === -1) return undefined;
    const [asset] = queue.splice(index, 1);
    if (asset) filled += 1;
    return asset;
  };

  const next = structuredClone(content);
  const alt = (asset: MediaAssetRow) => asset.alt_text ?? `${content.business.name} photo`;

  if (!next.hero.image?.url) {
    const pick = take("hero");
    if (pick) next.hero.image = { url: pick.url, alt: alt(pick) };
  }
  if (!next.about.image?.url) {
    const pick = take();
    if (pick) next.about.image = { url: pick.url, alt: alt(pick) };
  }

  const existingGallery = next.gallery.images.filter((image) => image.url);
  while (existingGallery.length < GALLERY_TARGET) {
    const pick = take();
    if (!pick) break;
    existingGallery.push({ url: pick.url, alt: alt(pick) });
  }
  next.gallery = { ...next.gallery, images: existingGallery };

  return { content: next, filled };
}
