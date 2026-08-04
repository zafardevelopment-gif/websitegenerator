import type { Metadata } from "next";

import {
  buildFallbackContent,
  getColorVariant,
  getLayoutVariant,
  getTemplate,
  parseBrandingOverrides,
  parseSiteContent,
  resolveBranding,
  type DemoInfo,
} from "@aiwebsite/templates";

import { HoldingPage } from "@/components/holding";
import { getSitePreviewBundle } from "@/lib/site-data";

/**
 * Editor preview: renders a site by id regardless of publish status,
 * uncached, optionally pinned to a version (?v=<versionId>).
 * Used by the admin generator's iframe.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site preview",
  robots: { index: false, follow: false },
};

export default async function SitePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { siteId } = await params;
  const { v } = await searchParams;

  let bundle: Awaited<ReturnType<typeof getSitePreviewBundle>> = null;
  try {
    bundle = await getSitePreviewBundle(siteId, v ?? null);
  } catch {
    bundle = null;
  }
  if (!bundle) return <HoldingPage kind="not-found" slug={siteId} />;

  const { site, agency } = bundle;
  const template = getTemplate(bundle.templateKey);
  const content =
    parseSiteContent(bundle.content) ?? buildFallbackContent({ businessName: site.name });
  const branding = resolveBranding(
    getColorVariant(template, site.color_variant),
    parseBrandingOverrides(site.branding),
    template.defaultFonts
  );
  const layout = getLayoutVariant(template, site.layout_variant);
  const demo: DemoInfo = {
    enabled: site.mode === "demo",
    agencyName: agency.name,
    agencyWhatsapp: agency.whatsapp,
    expiresAt: site.demo_expires_at,
  };

  const Template = template.component;
  return <Template content={content} branding={branding} layout={layout} demo={demo} />;
}
