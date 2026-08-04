import type { ResolvedBranding } from "./branding";
import type { DemoInfo } from "./components/sections";
import type { SiteContent } from "./schema";

export interface TemplateProps {
  content: SiteContent;
  branding: ResolvedBranding;
  /** One of the template's layoutVariants keys. */
  layout: string;
  demo: DemoInfo;
}
