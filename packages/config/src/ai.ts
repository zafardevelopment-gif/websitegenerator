/** AI engine configuration stored in aiwebsite_settings under `ai_config`. */

export interface AiConfig {
  anthropicModel: string;
  geminiModel: string;
  openaiCompatModel: string;
  /** Thinking/output effort for Claude ("low" | "medium" | "high"). */
  effort: "low" | "medium" | "high";
  monthlyBudgetInr: number;
  usdToInr: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  anthropicModel: "claude-opus-4-8",
  geminiModel: "gemini-2.5-flash",
  openaiCompatModel: "",
  effort: "medium",
  monthlyBudgetInr: 5000,
  usdToInr: 90,
};

export function normalizeAiConfig(raw: unknown): AiConfig {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_AI_CONFIG };
  const r = raw as Partial<Record<keyof AiConfig, unknown>>;
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  const effort = ["low", "medium", "high"].includes(r.effort as string)
    ? (r.effort as AiConfig["effort"])
    : DEFAULT_AI_CONFIG.effort;
  return {
    anthropicModel: str(r.anthropicModel, DEFAULT_AI_CONFIG.anthropicModel),
    geminiModel: str(r.geminiModel, DEFAULT_AI_CONFIG.geminiModel),
    openaiCompatModel: typeof r.openaiCompatModel === "string" ? r.openaiCompatModel.trim() : "",
    effort,
    monthlyBudgetInr: num(r.monthlyBudgetInr, DEFAULT_AI_CONFIG.monthlyBudgetInr),
    usdToInr: num(r.usdToInr, DEFAULT_AI_CONFIG.usdToInr),
  };
}
