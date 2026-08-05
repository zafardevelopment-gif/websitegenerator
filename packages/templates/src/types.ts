import type { ResolvedBranding } from "./branding";
import type { DemoInfo } from "./components/sections";
import type { SiteContent } from "./schema";

/** Visual/copy tone preset — mirrors `TonePreset` in @aiwebsite/ai. */
export type TonePreset = "premium" | "friendly" | "medical-professional" | "luxury";

export interface TemplateProps {
  content: SiteContent;
  branding: ResolvedBranding;
  /** One of the template's layoutVariants keys. */
  layout: string;
  demo: DemoInfo;
  /** Visual tone — shifts heading weight/tracking, corner radius, section density. Defaults to "premium". */
  tone?: TonePreset;
}
