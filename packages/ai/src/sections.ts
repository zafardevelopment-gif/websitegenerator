import type { ZodType } from "zod/v4";

import {
  SECTION_LABELS,
  sectionSchema,
  type SiteSectionKey,
} from "@aiwebsite/templates";

import type { AiEngine } from "./engine";
import { buildSiteContentPrompt, type LeadFacts, type SiteContentPromptOptions } from "./site-content";

/**
 * Regenerates a single SiteContent section, validated against that
 * section's sub-schema. Used by the editor's "Regenerate with AI" buttons.
 */
export async function regenerateSection(
  engine: AiEngine,
  lead: LeadFacts,
  options: SiteContentPromptOptions,
  sectionKey: SiteSectionKey,
  currentSection: unknown,
  instruction: string
): Promise<unknown> {
  const { system } = buildSiteContentPrompt(lead, options);

  const prompt = [
    `Regenerate ONLY the "${sectionKey}" (${SECTION_LABELS[sectionKey]}) section of this business website.`,
    "",
    "CURRENT SECTION JSON (match this exact structure):",
    JSON.stringify(currentSection, null, 2),
    "",
    instruction.trim()
      ? `SPECIFIC INSTRUCTION FROM THE EDITOR: ${instruction.trim()}`
      : "Improve the copy: sharper, more specific to this business and locality, zero filler.",
    "",
    "Return the JSON object for this section only — same structure, no wrapper, no prose.",
  ].join("\n");

  // The per-key schemas form a union; callers receive the validated value
  // as unknown and re-validate on full-content save.
  const schema = sectionSchema(sectionKey) as unknown as ZodType<unknown>;
  const result = await engine.generateStructured({ system, prompt, maxTokens: 3000 }, schema);
  return result.value;
}
