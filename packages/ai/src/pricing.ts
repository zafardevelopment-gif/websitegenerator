import type { AiProviderName } from "./types";

/**
 * Cost estimation. Prices in USD per 1M tokens (input, output).
 * Cached 2026-06; unknown models fall back to a conservative estimate.
 * INR conversion rate comes from the ai_config setting.
 */

const PRICES: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  // Google
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

const FALLBACK = { input: 5, output: 25 };

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICES[model] ?? FALLBACK;
  const usd = (tokensIn / 1_000_000) * price.input + (tokensOut / 1_000_000) * price.output;
  return Number(usd.toFixed(6));
}

export function estimateCostInr(
  model: string,
  tokensIn: number,
  tokensOut: number,
  usdToInr: number
): number {
  return Number((estimateCostUsd(model, tokensIn, tokensOut) * usdToInr).toFixed(4));
}

/** Model choices offered in Settings → AI. */
export const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 — most capable ($5/$25 per MTok)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — fast & strong ($3/$15)" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — cheapest ($1/$5)" },
] as const;

export const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash ($0.30/$2.50)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro ($1.25/$10)" },
] as const;

export type { AiProviderName };
