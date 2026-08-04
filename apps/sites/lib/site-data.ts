import "server-only";

import { unstable_cache } from "next/cache";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { getJsonSetting } from "@aiwebsite/db/settings";
import { getDomain } from "@aiwebsite/db/repositories/domains";
import { getLiveSiteBySlug, getSite } from "@aiwebsite/db/repositories/sites";
import { getSiteVersion } from "@aiwebsite/db/repositories/site-versions";
import type { Json, SiteRow } from "@aiwebsite/db/types";

export interface AgencyInfo {
  name: string;
  whatsapp: string;
}

export interface SiteBundle {
  site: SiteRow;
  templateKey: string | null;
  content: Json | null;
  agency: AgencyInfo;
}

async function fetchAgency(): Promise<AgencyInfo> {
  try {
    const db = createAdminSupabase();
    const raw = await getJsonSetting(db, SETTING_KEYS.agencyProfile);
    const profile = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
      name: typeof profile.name === "string" && profile.name ? profile.name : "AIVEXA",
      whatsapp: typeof profile.whatsapp === "string" ? profile.whatsapp : "",
    };
  } catch {
    return { name: "AIVEXA", whatsapp: "" };
  }
}

/**
 * `tenant` is a subdomain slug in the common case, but the middleware
 * (Phase 14) passes any unrecognized host through unchanged too — so an
 * unknown "slug" is retried as a verified custom domain lookup.
 */
async function resolveSite(db: ReturnType<typeof createAdminSupabase>, tenant: string) {
  const bySlug = await getLiveSiteBySlug(db, tenant);
  if (bySlug) return bySlug;

  const domain = await getDomain(db, tenant);
  if (!domain || domain.status !== "active") return null;
  return getSite(db, domain.site_id);
}

async function fetchBundle(slug: string): Promise<SiteBundle | null> {
  const db = createAdminSupabase();
  const site = await resolveSite(db, slug);
  if (!site || site.deleted_at) return null;

  let content: Json | null = null;
  if (site.current_version_id) {
    const version = await getSiteVersion(db, site.current_version_id);
    content = version?.site_content ?? null;
  }

  let templateKey: string | null = null;
  if (site.template_id) {
    const { data } = await db
      .from("aiwebsite_templates")
      .select("key")
      .eq("id", site.template_id)
      .maybeSingle();
    templateKey = data?.key ?? null;
  }

  return { site, templateKey, content, agency: await fetchAgency() };
}

/**
 * Tag-cached site lookup. Publishing from the admin app hits
 * POST /api/revalidate with tag `site:<slug>` for instant updates;
 * the 5-minute revalidate window is only a safety net.
 */
export function getSiteBundle(slug: string): Promise<SiteBundle | null> {
  return unstable_cache(() => fetchBundle(slug), ["site-bundle", slug], {
    tags: [`site:${slug}`],
    revalidate: 300,
  })();
}

/**
 * Uncached lookup by site id for the admin editor preview — renders drafts
 * and any specific version, ignoring publish status.
 */
export async function getSitePreviewBundle(
  siteId: string,
  versionId?: string | null
): Promise<SiteBundle | null> {
  const db = createAdminSupabase();
  const { data: site } = await db
    .from("aiwebsite_sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;

  const targetVersionId = versionId ?? site.current_version_id;
  let content: Json | null = null;
  if (targetVersionId) {
    const version = await getSiteVersion(db, targetVersionId);
    if (version?.site_id === site.id) content = version.site_content;
  }

  let templateKey: string | null = null;
  if (site.template_id) {
    const { data } = await db
      .from("aiwebsite_templates")
      .select("key")
      .eq("id", site.template_id)
      .maybeSingle();
    templateKey = data?.key ?? null;
  }

  return { site, templateKey, content, agency: await fetchAgency() };
}
