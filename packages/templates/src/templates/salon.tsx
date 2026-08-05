import {
  AboutSection,
  ContactSection,
  CtaBand,
  FaqsSection,
  GallerySection,
  Hero,
  ReviewsSection,
  ServicesSection,
  SiteFooter,
  SiteHeader,
  SiteShell,
  TestimonialsSection,
  TrustMarquee,
  WhyUsSection,
} from "../components/sections";
import type { TemplateProps } from "../types";

/**
 * Velvet Chair — editorial beauty aesthetic. Story before price list, and the
 * service menu is rendered as a typographic list rather than cards.
 * Layouts: "classic" (cinematic) | "split-hero".
 */
export function SalonTemplate({ content, branding, layout, demo, tone = "premium" }: TemplateProps) {
  return (
    <SiteShell content={content} branding={branding} demo={demo} tone={tone}>
      <SiteHeader content={content} />
      <main>
        <Hero content={content} layout={layout === "split-hero" ? "split" : "cinematic"} />
        <TrustMarquee content={content} />
        <AboutSection content={content} />
        <ServicesSection content={content} style="list" />
        <GallerySection content={content} />
        <TestimonialsSection content={content} />
        <ReviewsSection content={content} />
        <WhyUsSection content={content} />
        <FaqsSection content={content} />
        <CtaBand content={content} />
        <ContactSection content={content} />
      </main>
      <SiteFooter content={content} />
    </SiteShell>
  );
}
