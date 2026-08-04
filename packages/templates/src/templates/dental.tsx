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
 * Bright Smile — clinical calm, appointment-first. Trust signals sit high
 * on the page (marquee + stats) because medical intent converts on credibility.
 * Layouts: "classic" (cinematic hero) | "split-hero" (text + portrait visual).
 */
export function DentalTemplate({ content, branding, layout, demo }: TemplateProps) {
  return (
    <SiteShell content={content} branding={branding} demo={demo}>
      <SiteHeader content={content} />
      <main>
        <Hero content={content} layout={layout === "split-hero" ? "split" : "cinematic"} />
        <TrustMarquee content={content} />
        <ServicesSection content={content} />
        <AboutSection content={content} />
        <StatsBand content={content} />
        <WhyUsSection content={content} />
        <GallerySection content={content} />
        <ReviewsSection content={content} />
        <TestimonialsSection content={content} />
        <FaqsSection content={content} />
        <CtaBand content={content} />
        <ContactSection content={content} />
      </main>
      <SiteFooter content={content} />
    </SiteShell>
  );
}
