import { z } from "zod/v4";

/**
 * SiteContent — THE contract between the AI engine (Phase 6), the section
 * editor (Phase 7), version snapshots (aiwebsite_site_versions.site_content)
 * and the renderer (apps/sites).
 *
 * Rules:
 *  - Every template renders exclusively from this shape.
 *  - One SiteContent = one language. Bilingual sites store a second
 *    SiteContent for Hindi (Phase 6) and the renderer toggles between them.
 *  - Testimonials are ALWAYS generic samples — enforced by prompt + label.
 */

const imageSchema = z.object({
  url: z.string(),
  alt: z.string().default(""),
});

export const siteContentSchema = z.object({
  meta: z.object({
    title: z.string().min(1).max(70),
    description: z.string().min(1).max(200),
    keywords: z.array(z.string()).default([]),
  }),

  business: z.object({
    name: z.string().min(1),
    category: z.string().default(""),
    phone: z.string().default(""),
    whatsapp: z.string().default(""),
    email: z.string().default(""),
    address: z.string().default(""),
    area: z.string().default(""),
    city: z.string().default(""),
    mapUrl: z.string().default(""),
    mapEmbedUrl: z.string().default(""),
    rating: z.number().min(0).max(5).nullable().default(null),
    reviewCount: z.number().int().min(0).nullable().default(null),
    socials: z
      .object({
        instagram: z.string().default(""),
        facebook: z.string().default(""),
        linkedin: z.string().default(""),
      })
      .default({ instagram: "", facebook: "", linkedin: "" }),
    openingHours: z
      .array(z.object({ days: z.string(), hours: z.string() }))
      .default([]),
  }),

  hero: z.object({
    badge: z.string().default(""),
    title: z.string().min(1).max(90),
    subtitle: z.string().max(220).default(""),
    ctaPrimary: z.string().min(1).default("Contact Us"),
    ctaSecondary: z.string().default(""),
    image: imageSchema.nullable().default(null),
  }),

  about: z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
    highlights: z.array(z.string()).default([]),
    image: imageSchema.nullable().default(null),
  }),

  services: z.object({
    heading: z.string().min(1).default("Our Services"),
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          description: z.string().default(""),
          icon: z.string().default("sparkles"),
        })
      )
      .min(1),
  }),

  whyUs: z.object({
    heading: z.string().default("Why Choose Us"),
    items: z
      .array(z.object({ title: z.string(), description: z.string().default("") }))
      .default([]),
  }).default({ heading: "Why Choose Us", items: [] }),

  gallery: z.object({
    heading: z.string().default("Gallery"),
    images: z.array(imageSchema).default([]),
  }).default({ heading: "Gallery", images: [] }),

  testimonials: z.object({
    heading: z.string().default("What Customers Say"),
    /** Always rendered with a "sample" disclaimer. */
    items: z
      .array(
        z.object({
          name: z.string(),
          text: z.string(),
          rating: z.number().min(1).max(5).default(5),
        })
      )
      .default([]),
  }).default({ heading: "What Customers Say", items: [] }),

  faqs: z.object({
    heading: z.string().default("Frequently Asked Questions"),
    items: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }).default({ heading: "Frequently Asked Questions", items: [] }),

  reviews: z.object({
    heading: z.string().default("Loved on Google"),
    /** Short quotes derived from real Google review data. */
    snippets: z.array(z.string()).default([]),
  }).default({ heading: "Loved on Google", snippets: [] }),

  cta: z.object({
    heading: z.string().default("Ready to get started?"),
    subheading: z.string().default(""),
    buttonText: z.string().default("WhatsApp Us"),
  }).default({ heading: "Ready to get started?", subheading: "", buttonText: "WhatsApp Us" }),

  contact: z.object({
    heading: z.string().default("Contact Us"),
    note: z.string().default(""),
  }).default({ heading: "Contact Us", note: "" }),

  footer: z.object({
    tagline: z.string().default(""),
  }).default({ tagline: "" }),
});

export type SiteContent = z.infer<typeof siteContentSchema>;
export type SiteImage = z.infer<typeof imageSchema>;

/** Editable/regenerable sections, in editor display order. */
export const SITE_SECTION_KEYS = [
  "hero",
  "about",
  "services",
  "whyUs",
  "reviews",
  "testimonials",
  "faqs",
  "cta",
  "contact",
  "gallery",
  "business",
  "meta",
  "footer",
] as const;
export type SiteSectionKey = (typeof SITE_SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SiteSectionKey, string> = {
  hero: "Hero",
  about: "About",
  services: "Services",
  whyUs: "Why Choose Us",
  reviews: "Google Reviews",
  testimonials: "Testimonials",
  faqs: "FAQs",
  cta: "CTA Band",
  contact: "Contact",
  gallery: "Gallery",
  business: "Business Facts",
  meta: "SEO Meta",
  footer: "Footer",
};

/** Zod sub-schema for one section (drives per-section AI regeneration). */
export function sectionSchema(key: SiteSectionKey) {
  return siteContentSchema.shape[key];
}

/**
 * Lenient parse for content coming from the DB: fills defaults, tolerates
 * missing optional sections. Returns null only if required essentials
 * (business name, hero title, ≥1 service…) can't be recovered.
 */
export function parseSiteContent(json: unknown): SiteContent | null {
  const result = siteContentSchema.safeParse(json);
  return result.success ? result.data : null;
}

/** Minimal valid content from bare business facts (fallback / scaffolding). */
export function buildFallbackContent(input: {
  businessName: string;
  category?: string;
  phone?: string;
  area?: string;
  city?: string;
}): SiteContent {
  const where = [input.area, input.city].filter(Boolean).join(", ");
  return siteContentSchema.parse({
    meta: {
      title: `${input.businessName}${where ? ` — ${where}` : ""}`.slice(0, 70),
      description:
        `${input.businessName}${input.category ? `, ${input.category}` : ""}${where ? ` in ${where}` : ""}. Contact us today.`.slice(
          0,
          200
        ),
    },
    business: {
      name: input.businessName,
      category: input.category ?? "",
      phone: input.phone ?? "",
      whatsapp: input.phone ?? "",
      area: input.area ?? "",
      city: input.city ?? "",
    },
    hero: {
      title: input.businessName,
      subtitle: where ? `Serving ${where} with pride.` : "",
      ctaPrimary: "Contact Us",
    },
    about: {
      heading: `About ${input.businessName}`,
      body: `${input.businessName} is a trusted local business${where ? ` in ${where}` : ""}.`,
    },
    services: {
      heading: "Our Services",
      items: [{ name: "Our Services", description: "Get in touch to know more.", icon: "sparkles" }],
    },
  });
}
