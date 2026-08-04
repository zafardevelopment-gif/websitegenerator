import type { Metadata } from "next";

import { AGENCY_NAME } from "@aiwebsite/config";
import {
  getColorVariant,
  getLayoutVariant,
  getTemplate,
  resolveBranding,
  type DemoInfo,
} from "@aiwebsite/templates";

/**
 * Live template preview with sample content — embedded by the admin
 * gallery (Phase 5) and the generator's device preview (Phase 7).
 * /preview/dental?color=sky&layout=split-hero&banner=0
 */

interface PreviewProps {
  params: Promise<{ template: string }>;
  searchParams: Promise<{ color?: string; layout?: string; banner?: string }>;
}

export async function generateMetadata({ params }: PreviewProps): Promise<Metadata> {
  const { template } = await params;
  return {
    title: `${getTemplate(template).name} — template preview`,
    robots: { index: false, follow: false },
  };
}

export default async function PreviewPage({ params, searchParams }: PreviewProps) {
  const { template: key } = await params;
  const query = await searchParams;

  const template = getTemplate(key);
  const branding = resolveBranding(
    getColorVariant(template, query.color ?? null),
    {},
    template.defaultFonts
  );
  const layout = getLayoutVariant(template, query.layout ?? null);
  const demo: DemoInfo = {
    enabled: query.banner !== "0",
    agencyName: AGENCY_NAME,
    agencyWhatsapp: "",
    expiresAt: null,
  };

  const Template = template.component;
  return (
    <Template content={template.sampleContent} branding={branding} layout={layout} demo={demo} />
  );
}
