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
} from "../components/sections";
import type { TemplateProps } from "../types";

/**
 * Tandoor Table — dark, appetite-driven. Services render as a menu list and
 * the gallery carries most of the persuasion.
 * Layouts: "classic" (story first) | "gallery-first" (menu + photos first).
 */
export function RestaurantTemplate({ content, branding, layout, demo, tone = "premium" }: TemplateProps) {
  const menuFirst = layout === "gallery-first";
  return (
    <SiteShell content={content} branding={branding} demo={demo} tone={tone}>
      <SiteHeader content={content} variant="dark" />
      <main>
        <Hero content={content} layout="cinematic" dark />
        <TrustMarquee content={content} />
        {menuFirst ? (
          <>
            <ServicesSection content={content} style="list" />
            <GallerySection content={content} />
            <AboutSection content={content} />
          </>
        ) : (
          <>
            <AboutSection content={content} />
            <ServicesSection content={content} style="list" />
            <GallerySection content={content} />
          </>
        )}
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
