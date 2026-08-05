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
  StatsBand,
  TestimonialsSection,
  TrustMarquee,
  WhyUsSection,
} from "../components/sections";
import type { TemplateProps } from "../types";

/**
 * Local Pro — versatile professional layout for any local business.
 * Layouts: "classic" (editorial split hero) | "compact" (cinematic, tighter).
 */
export function GeneralTemplate({ content, branding, layout, demo, tone = "premium" }: TemplateProps) {
  const compact = layout === "compact";
  return (
    <SiteShell content={content} branding={branding} demo={demo} tone={tone}>
      <SiteHeader content={content} />
      <main>
        <Hero content={content} layout={compact ? "cinematic" : "split"} />
        <TrustMarquee content={content} />
        <ServicesSection content={content} />
        <AboutSection content={content} />
        {!compact && <StatsBand content={content} />}
        <WhyUsSection content={content} />
        <GallerySection content={content} />
        <ReviewsSection content={content} />
        {!compact && <TestimonialsSection content={content} />}
        <FaqsSection content={content} />
        <CtaBand content={content} />
        <ContactSection content={content} />
      </main>
      <SiteFooter content={content} />
    </SiteShell>
  );
}
