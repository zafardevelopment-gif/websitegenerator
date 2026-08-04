import type { SiteContent } from "@aiwebsite/templates";

/** Schema.org LocalBusiness JSON-LD for a live site. */
export function localBusinessJsonLd(content: SiteContent, url: string): Record<string, unknown> {
  const b = content.business;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    description: content.meta.description,
    url,
  };
  if (b.phone) jsonLd.telephone = b.phone;
  if (b.email) jsonLd.email = b.email;
  if (b.address) {
    jsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: b.address,
      addressLocality: b.city || b.area,
      addressCountry: "IN",
    };
  }
  if (b.rating !== null && b.reviewCount !== null && b.reviewCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: b.rating,
      reviewCount: b.reviewCount,
      bestRating: 5,
    };
  }
  if (b.openingHours.length > 0) {
    jsonLd.openingHours = b.openingHours.map((slot) => `${slot.days} ${slot.hours}`);
  }
  const socials = [b.socials.instagram, b.socials.facebook, b.socials.linkedin].filter(Boolean);
  if (socials.length > 0) {
    jsonLd.sameAs = socials.map((s) => (s.startsWith("http") ? s : `https://${s}`));
  }
  return jsonLd;
}
