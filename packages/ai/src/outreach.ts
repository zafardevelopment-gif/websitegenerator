import type { AiEngine } from "./engine";
import type { LeadFacts } from "./site-content";

export interface OutreachVariables {
  owner: string;
  business: string;
  rating: string;
  reviews: string;
  demo_url: string;
  area: string;
}

/** Substitutes {var} placeholders in a stored template body. */
export function fillTemplate(body: string, vars: OutreachVariables): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key as keyof OutreachVariables] : match
  );
}

export function buildOutreachVariables(lead: LeadFacts, demoUrl: string): OutreachVariables {
  return {
    owner: lead.ownerName || "there",
    business: lead.businessName,
    rating: lead.googleRating !== null ? lead.googleRating.toFixed(1) : "",
    reviews: lead.reviewCount !== null ? String(lead.reviewCount) : "",
    demo_url: demoUrl,
    area: lead.area || lead.city || "",
  };
}

/**
 * AI-personalizes a WhatsApp pitch: takes the base template (already
 * variable-substituted) and asks the model to weave in 1-2 specific
 * compliments grounded in the real rating/review data — never invented.
 */
export async function personalizeWhatsAppPitch(
  engine: AiEngine,
  lead: LeadFacts,
  baseMessage: string
): Promise<string> {
  const system =
    "You write short, warm Hinglish WhatsApp messages for Indian business owners pitching a website demo. " +
    "Personalize using ONLY the facts given — never invent a rating, review count, or compliment not grounded in the data. " +
    "Keep it to 3 short paragraphs max, at most one emoji per paragraph, and preserve the demo URL and CTA exactly.";

  const prompt = [
    "BUSINESS DATA:",
    `Name: ${lead.businessName}`,
    lead.category && `Category: ${lead.category}`,
    lead.googleRating !== null && `Google rating: ${lead.googleRating}★ (${lead.reviewCount ?? "?"} reviews)`,
    lead.area && `Area: ${lead.area}`,
    "",
    "BASE MESSAGE TEMPLATE (rewrite this — keep the same intent and any URLs exactly, personalize the opening with 1-2 specific compliments grounded in the data above):",
    baseMessage,
    "",
    "Return only the rewritten message text, no explanation.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await engine.complete({ system, prompt, maxTokens: 1000 });
  return result.text.trim();
}
