import { siteContentSchema, type SiteContent } from "@aiwebsite/templates";

import type { AiEngine, StructuredResult } from "./engine";

/** Everything the prompt builder needs about a lead. */
export interface LeadFacts {
  businessName: string;
  category: string | null;
  ownerName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  services: string[];
  businessDescription: string | null;
  notes: string | null;
}

export type ContentLanguage = "en" | "hi";
export type TonePreset = "premium" | "friendly" | "medical-professional" | "luxury";

export const TONE_PRESETS: Record<TonePreset, string> = {
  premium:
    "Tone: premium and confident. Polished, modern, aspirational — never salesy or exaggerated.",
  friendly:
    "Tone: warm and friendly. Conversational, approachable, human — like a helpful neighbour.",
  "medical-professional":
    "Tone: medical-professional. Calm, precise, reassuring. No exaggerated claims, no urgency tactics.",
  luxury:
    "Tone: luxury. Elegant, refined, understated. Short sentences, evocative vocabulary, zero clichés.",
};

const ICON_VOCABULARY =
  "sparkles, tooth, smile, implant, braces, shield, heart, health, stethoscope, scissors, brush, dumbbell, fitness, food, utensils, camera, wrench, briefcase, star, clock";

export interface SiteContentPromptOptions {
  /** Active system prompt from aiwebsite_prompt_templates (category or default). */
  systemPrompt: string;
  tone: TonePreset;
  language: ContentLanguage;
}

/** Builds the {system, prompt} pair for SiteContent generation. */
export function buildSiteContentPrompt(
  lead: LeadFacts,
  options: SiteContentPromptOptions
): { system: string; prompt: string } {
  const where = [lead.area, lead.city].filter(Boolean).join(", ");

  const system = [
    options.systemPrompt.trim(),
    TONE_PRESETS[options.tone],
    options.language === "hi"
      ? "Write ALL content in natural, everyday Hindi (Devanagari script). Keep business name, phone numbers and technical terms as-is."
      : "Write all content in clear, simple English (Indian audience).",
    "Hard rules: never invent facts not present in the business data; testimonials must be clearly generic samples (names like 'Happy Customer'), never real-sounding named people; service icons must be one of: " +
      ICON_VOCABULARY +
      "; meta.title ≤ 70 chars; meta.description ≤ 200 chars; hero.title ≤ 90 chars.",
  ].join("\n\n");

  const facts = [
    `Business name: ${lead.businessName}`,
    lead.category && `Category: ${lead.category}`,
    lead.ownerName && `Owner: ${lead.ownerName}`,
    lead.phone && `Phone: ${lead.phone}`,
    lead.whatsapp && `WhatsApp: ${lead.whatsapp}`,
    lead.email && `Email: ${lead.email}`,
    lead.address && `Address: ${lead.address}`,
    where && `Locality: ${where}`,
    lead.googleRating !== null &&
      `Google rating: ${lead.googleRating}★ from ${lead.reviewCount ?? "?"} reviews`,
    lead.services.length > 0 && `Known services: ${lead.services.join(", ")}`,
    lead.businessDescription && `Description: ${lead.businessDescription}`,
    lead.notes && `Internal notes: ${lead.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "Generate the complete website content for this local business as a single JSON object matching the SiteContent schema.",
    "",
    "BUSINESS DATA:",
    facts,
    "",
    "Include: SEO meta (title/description/keywords), hero (badge/title/subtitle/CTAs), about (with 3-4 short highlights), 4-6 services with one-line descriptions and icons, 4 why-us points, 2-3 sample testimonials, 3-5 FAQs a customer in this locality would actually ask, 2-3 short review snippets consistent with the rating data, a CTA band and footer tagline.",
    "Echo the business contact facts into the business section verbatim; leave unknown fields as empty strings and unknown numbers as null.",
    "Return JSON only.",
  ].join("\n");

  return { system, prompt };
}

export const SITE_CONTENT_MAX_TOKENS = 8000;

/** One language. */
export async function generateSiteContent(
  engine: AiEngine,
  lead: LeadFacts,
  options: SiteContentPromptOptions
): Promise<StructuredResult<SiteContent>> {
  const { system, prompt } = buildSiteContentPrompt(lead, options);
  return engine.generateStructured(
    { system, prompt, maxTokens: SITE_CONTENT_MAX_TOKENS },
    siteContentSchema
  );
}

/** en / hi / bilingual (bilingual = both, English primary). */
export async function generateSiteContentBundle(
  engine: AiEngine,
  lead: LeadFacts,
  options: { systemPrompt: string; tone: TonePreset; language: "en" | "hi" | "bilingual" }
): Promise<{ en: StructuredResult<SiteContent> | null; hi: StructuredResult<SiteContent> | null }> {
  const en =
    options.language !== "hi"
      ? await generateSiteContent(engine, lead, { ...options, language: "en" })
      : null;
  const hi =
    options.language !== "en"
      ? await generateSiteContent(engine, lead, { ...options, language: "hi" })
      : null;
  return { en, hi };
}
