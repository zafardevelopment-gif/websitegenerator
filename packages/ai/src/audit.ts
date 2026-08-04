import { z } from "zod/v4";

import type { AiEngine } from "./engine";

export const auditSchema = z.object({
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  seoRecommendations: z.array(z.string()).default([]),
  conversionRecommendations: z.array(z.string()).default([]),
  trustRecommendations: z.array(z.string()).default([]),
  speedRecommendations: z.array(z.string()).default([]),
  accessibilityRecommendations: z.array(z.string()).default([]),
  summary: z.string().default(""),
});
export type WebsiteAudit = z.infer<typeof auditSchema>;

export interface AuditInput {
  businessName: string;
  category: string | null;
  scores: {
    seo: number | null;
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    mobile: number | null;
    desktop: number | null;
  };
  hasExistingWebsite: boolean;
}

/** AI-generated audit narrative from the raw Lighthouse-style scores. */
export async function generateWebsiteAudit(
  engine: AiEngine,
  input: AuditInput
): Promise<WebsiteAudit> {
  const system =
    "You are a technical SEO and web-conversion auditor writing a client-facing report for a small local business. " +
    "Be specific and actionable, never generic filler. Base every point strictly on the scores given — do not invent metrics you weren't given. " +
    "Write in plain, non-technical language a business owner can understand.";

  const prompt = [
    `Business: ${input.businessName}${input.category ? ` (${input.category})` : ""}`,
    `Has an existing website: ${input.hasExistingWebsite ? "yes" : "no"}`,
    "",
    "Scores (0-100, from Google PageSpeed Insights):",
    `SEO: ${input.scores.seo ?? "not measured"}`,
    `Performance: ${input.scores.performance ?? "not measured"}`,
    `Accessibility: ${input.scores.accessibility ?? "not measured"}`,
    `Best Practices: ${input.scores.bestPractices ?? "not measured"}`,
    `Mobile: ${input.scores.mobile ?? "not measured"}`,
    `Desktop: ${input.scores.desktop ?? "not measured"}`,
    "",
    "Write a short audit as JSON with: strengths (2-3 bullets), weaknesses (2-4 bullets), " +
      "seoRecommendations, conversionRecommendations, trustRecommendations, speedRecommendations, " +
      "accessibilityRecommendations (1-3 bullets each, only include categories with a real finding), " +
      "and a 2-sentence summary. Return JSON only.",
  ].join("\n");

  const result = await engine.generateStructured({ system, prompt, maxTokens: 2000 }, auditSchema);
  return result.value;
}

/** Simple weighted overall score from whatever sub-scores are available. */
export function computeOverallScore(scores: Record<string, number | null>): number | null {
  const values = Object.values(scores).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}
