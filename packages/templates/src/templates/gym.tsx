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
 * Iron Pulse — high-energy dark theme. Numbers do the selling, so the stats
 * band can be pulled directly under the hero.
 * Layouts: "classic" | "stats-first".
 */
export function GymTemplate({ content, branding, layout, demo, tone = "premium" }: TemplateProps) {
  const statsFirst = layout === "stats-first";
  return (
    <SiteShell content={content} branding={branding} demo={demo} tone={tone}>
      <SiteHeader content={content} variant="dark" />
      <main>
        <Hero content={content} layout="cinematic" dark />
        <TrustMarquee content={content} />
        {statsFirst && <StatsBand content={content} />}
        <ServicesSection content={content} />
        <AboutSection content={content} />
        {!statsFirst && <StatsBand content={content} />}
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
