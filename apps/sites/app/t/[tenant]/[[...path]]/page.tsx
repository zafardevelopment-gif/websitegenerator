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
import { localBusinessJsonLd } from "@/lib/jsonld";
import { getSiteBundle } from "@/lib/site-data";

/**
 * Multi-tenant renderer. Reached via the middleware rewrite
 * host → /t/<tenant>/<path>. Renders the site's current version through
 * its template; non-live states get branded holding pages.
 */

interface TenantParams {
  params: Promise<{ tenant: string }>;
}

function normalizeSlug(tenant: string): string {
  return decodeURIComponent(tenant).toLowerCase();
}

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "aivexallp.com";

function publicUrl(slug: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${slug}.localhost:3001`
    : `https://${slug}.${BASE_DOMAIN}`;
}

/** Visitors must never see an error page — degrade to "not live". */
async function safeGetBundle(slug: string) {
  try {
    return await getSiteBundle(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: TenantParams): Promise<Metadata> {
  const { tenant } = await params;
  const slug = normalizeSlug(tenant);
  const bundle = await safeGetBundle(slug);

  if (!bundle || (bundle.site.status !== "live" && bundle.site.status !== "converted")) {
    return { title: "Website not available", robots: { index: false, follow: false } };
  }

  const content = parseSiteContent(bundle.content);
  const title = content?.meta.title ?? bundle.site.name;
  const description = content?.meta.description ?? "";
  const noindex = bundle.site.noindex;

  return {
    title,
    description,
    keywords: content?.meta.keywords,
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    alternates: { canonical: publicUrl(slug) },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: bundle.site.name,
      url: publicUrl(slug),
      images: [{ url: `${publicUrl(slug)}/og/${slug}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${publicUrl(slug)}/og/${slug}`],
    },
  };
}

export default async function TenantPage({ params }: TenantParams) {
  const { tenant } = await params;
  const slug = normalizeSlug(tenant);
  const bundle = await safeGetBundle(slug);

  if (!bundle) {
    return <HoldingPage kind="not-found" slug={slug} />;
  }

  const { site, agency } = bundle;

  if (site.status === "draft" || site.status === "paused") {
    return <HoldingPage kind="unpublished" businessName={site.name} />;
  }
  if (site.status === "expired" || site.status === "archived") {
    return (
      <HoldingPage kind="expired" businessName={site.name} agencyWhatsapp={agency.whatsapp} />
    );
  }

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
  const jsonLd = localBusinessJsonLd(content, publicUrl(slug));
  return (
    <>
      <script
        type="application/ld+json"
        // Sanitized: content comes from our validated SiteContent, and
        // escaping < prevents script breakout.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Template content={content} branding={branding} layout={layout} demo={demo} />
      {/* Engagement tracking — only on live sites, never in editor/preview. */}
      <script src="/t.js" data-site={site.id} defer />
    </>
  );
}
