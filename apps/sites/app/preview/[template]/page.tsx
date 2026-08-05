import type { Metadata } from "next";

import { AGENCY_NAME } from "@aiwebsite/config";
import {
  getColorVariant,
  getLayoutVariant,
  getTemplate,
  resolveBranding,
  TONE_SAMPLE_COPY,
  type DemoInfo,
} from "@aiwebsite/templates";

/**
 * Live template preview with sample content — embedded by the admin
 * gallery (Phase 5) and the generator's device preview (Phase 7).
 * /preview/dental?color=sky&layout=split-hero&banner=0&tone=friendly
 */

const TONES = ["premium", "friendly", "medical-professional", "luxury"] as const;
type Tone = (typeof TONES)[number];

interface PreviewProps {
  params: Promise<{ template: string }>;
  searchParams: Promise<{ color?: string; layout?: string; banner?: string; tone?: string }>;
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
  const tone: Tone = TONES.includes(query.tone as Tone) ? (query.tone as Tone) : "premium";
  const demo: DemoInfo = {
    enabled: query.banner !== "0",
    agencyName: AGENCY_NAME,
    agencyWhatsapp: "",
    expiresAt: null,
  };

  const toneCopy = TONE_SAMPLE_COPY[template.key]?.[tone];
  const content = toneCopy
    ? {
        ...template.sampleContent,
        hero: { ...template.sampleContent.hero, title: toneCopy.title, subtitle: toneCopy.subtitle },
      }
    : template.sampleContent;

  const Template = template.component;
  return (
    <Template content={content} branding={branding} layout={layout} demo={demo} tone={tone} />
  );
}
