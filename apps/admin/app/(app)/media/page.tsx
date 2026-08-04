import type { Metadata } from "next";
import { Image as ImageIcon } from "lucide-react";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getLead } from "@aiwebsite/db/repositories/leads";
import {
  listMediaByLead,
  listRecentMedia,
  listStockAssets,
} from "@aiwebsite/db/repositories/media";
import type { MediaAssetRow } from "@aiwebsite/db/types";

import { getCloudinaryConfig } from "@/lib/server/cloudinary";

import { MediaManager, type MediaAssetView } from "./media-manager";

export const metadata: Metadata = {
  title: "Media library",
};

interface UsageSite {
  id: string;
  name: string;
  slug: string;
}

async function buildUsageIndex(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>
): Promise<{ contentBySite: Map<UsageSite, string> }> {
  const { data: sites } = await supabase
    .from("aiwebsite_sites")
    .select("id, name, slug, current_version_id")
    .is("deleted_at", null)
    .not("current_version_id", "is", null)
    .limit(300);

  const versionIds = (sites ?? [])
    .map((s) => s.current_version_id)
    .filter((v): v is string => v !== null);
  if (versionIds.length === 0) return { contentBySite: new Map() };

  const { data: versions } = await supabase
    .from("aiwebsite_site_versions")
    .select("id, site_content")
    .in("id", versionIds);

  const contentByVersion = new Map(
    (versions ?? []).map((v) => [v.id, JSON.stringify(v.site_content)])
  );
  const contentBySite = new Map<UsageSite, string>();
  for (const site of sites ?? []) {
    const content = site.current_version_id
      ? contentByVersion.get(site.current_version_id)
      : undefined;
    if (content) {
      contentBySite.set({ id: site.id, name: site.name, slug: site.slug }, content);
    }
  }
  return { contentBySite };
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; leadId?: string; category?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "stock" ? "stock" : "leads";

  const supabase = await createServerSupabase();
  const cloudinaryReady = (await getCloudinaryConfig()) !== null;

  let assets: MediaAssetRow[];
  let leadName: string | null = null;
  if (view === "stock") {
    assets = await listStockAssets(supabase, params.category || null);
  } else if (params.leadId) {
    assets = await listMediaByLead(supabase, params.leadId);
    leadName = (await getLead(supabase, params.leadId))?.business_name ?? null;
  } else {
    assets = await listRecentMedia(supabase);
  }

  // Usage: which sites' current content references each asset URL.
  const { contentBySite } = await buildUsageIndex(supabase);
  const views: MediaAssetView[] = assets.map((asset) => ({
    ...asset,
    usage: Array.from(contentBySite.entries())
      .filter(([, content]) => content.includes(asset.url))
      .map(([site]) => site),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          Media library
        </h1>
        <p className="text-sm text-muted-foreground">
          Cloudinary-backed uploads with per-lead folders and category stock pools. Delivered
          images get automatic WebP/AVIF + quality optimization.
        </p>
      </div>

      <MediaManager
        assets={views}
        view={view}
        leadId={params.leadId ?? null}
        leadName={leadName}
        category={params.category ?? ""}
        cloudinaryReady={cloudinaryReady}
      />
    </div>
  );
}
