import "server-only";

import {
  AiEngine,
  AnthropicProvider,
  estimateCostInr,
  estimateCostUsd,
  GeminiProvider,
  OpenAiCompatProvider,
  type AiProvider,
} from "@aiwebsite/ai";
import { normalizeAiConfig, SETTING_KEYS, type AiConfig } from "@aiwebsite/config";
import { createAdminSupabase } from "@aiwebsite/db/admin";
import { logAiUsage } from "@aiwebsite/db/repositories/ai-usage";
import { getDecryptedSetting, getJsonSetting } from "@aiwebsite/db/settings";
import type { DbClient } from "@aiwebsite/db/types";

export interface EngineContext {
  purpose: string;
  leadId?: string | null;
  siteId?: string | null;
  promptTemplateId?: string | null;
  userId?: string | null;
}

/** Env var wins; encrypted setting is the fallback. */
async function resolveKey(
  db: DbClient,
  envName: string,
  settingKey: Parameters<typeof getDecryptedSetting>[1]
): Promise<string | null> {
  const fromEnv = process.env[envName];
  if (fromEnv && fromEnv.trim() !== "") return fromEnv.trim();
  try {
    return await getDecryptedSetting(db, settingKey);
  } catch {
    return null;
  }
}

export async function loadAiConfig(db: DbClient): Promise<AiConfig> {
  return normalizeAiConfig(await getJsonSetting(db, SETTING_KEYS.aiConfig));
}

/**
 * Builds the failover engine (Claude → Gemini → OpenAI-compatible) from
 * Settings/env, with every attempt logged to aiwebsite_ai_usage_logs.
 * Uses the service-role client so cron/webhook contexts work too.
 */
export async function buildAiEngine(
  context: EngineContext
): Promise<{ engine: AiEngine; config: AiConfig; providerNames: string[] }> {
  const db = createAdminSupabase();
  const config = await loadAiConfig(db);

  const providers: AiProvider[] = [];

  const anthropicKey = await resolveKey(db, "ANTHROPIC_API_KEY", SETTING_KEYS.anthropicApiKey);
  if (anthropicKey) {
    providers.push(new AnthropicProvider(anthropicKey, config.anthropicModel, config.effort));
  }

  const geminiKey = await resolveKey(db, "GEMINI_API_KEY", SETTING_KEYS.geminiApiKey);
  if (geminiKey) {
    providers.push(new GeminiProvider(geminiKey, config.geminiModel));
  }

  const openaiBase =
    process.env.OPENAI_COMPAT_BASE_URL ??
    (await getDecryptedSetting(db, SETTING_KEYS.openaiCompatBaseUrl).catch(() => null));
  const openaiKey = await resolveKey(db, "OPENAI_COMPAT_API_KEY", SETTING_KEYS.openaiCompatApiKey);
  if (openaiBase && openaiKey && config.openaiCompatModel) {
    providers.push(new OpenAiCompatProvider(openaiBase, openaiKey, config.openaiCompatModel));
  }

  const engine = new AiEngine(providers, async (attempt) => {
    await logAiUsage(db, {
      provider: attempt.provider,
      model: attempt.model,
      purpose: context.purpose,
      lead_id: context.leadId ?? null,
      site_id: context.siteId ?? null,
      prompt_template_id: context.promptTemplateId ?? null,
      tokens_in: attempt.tokensIn,
      tokens_out: attempt.tokensOut,
      latency_ms: attempt.latencyMs,
      cost_usd: estimateCostUsd(attempt.model, attempt.tokensIn, attempt.tokensOut),
      cost_inr: estimateCostInr(attempt.model, attempt.tokensIn, attempt.tokensOut, config.usdToInr),
      success: attempt.success,
      error: attempt.error,
      created_by: context.userId ?? null,
    });
  });

  return { engine, config, providerNames: providers.map((p) => p.name) };
}
