"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { z as z4 } from "zod/v4";

import { SETTING_KEYS } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { saveJsonSetting } from "@aiwebsite/db/settings";
import { createPromptVersion } from "@aiwebsite/db/repositories/prompt-templates";
import type { Json } from "@aiwebsite/db/types";

import { buildAiEngine } from "../server/ai-engine";

export type AiActionResult = { ok: true; message: string } | { ok: false; error: string };

function friendly(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/row-level security/i.test(message)) return "Only the owner can change this.";
  return message;
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

// ── AI config ───────────────────────────────────────────────────────

const aiConfigSchema = z.object({
  anthropicModel: z.string().trim().min(1).max(80),
  geminiModel: z.string().trim().min(1).max(80),
  openaiCompatModel: z.string().trim().max(80),
  effort: z.enum(["low", "medium", "high"]),
  monthlyBudgetInr: z.number().min(0).max(10_000_000),
  usdToInr: z.number().min(1).max(1000),
});

export async function saveAiConfigAction(input: unknown): Promise<AiActionResult> {
  const parsed = aiConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid config" };
  }
  try {
    const { supabase, user } = await requireUser();
    await saveJsonSetting(supabase, SETTING_KEYS.aiConfig, parsed.data as unknown as Json, user.id);
    revalidatePath("/settings/ai");
    revalidatePath("/");
    return { ok: true, message: "AI configuration saved." };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Engine test ─────────────────────────────────────────────────────

// The AI engine's structured path requires zod/v4 schemas.
const testSchema = z4.object({
  headline: z4.string(),
  tagline: z4.string(),
});

export interface EngineTestReport {
  ok: boolean;
  provider?: string;
  model?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  headline?: string;
  tagline?: string;
  providersConfigured?: string[];
  error?: string;
}

/** Round-trip test: structured JSON generation through the failover chain. */
export async function testAiEngineAction(): Promise<EngineTestReport> {
  try {
    const { user } = await requireUser();
    const { engine, providerNames } = await buildAiEngine({
      purpose: "engine_test",
      userId: user.id,
    });
    const result = await engine.generateStructured(
      {
        system:
          "You write short marketing copy. Respond with JSON only: {\"headline\": string, \"tagline\": string}.",
        prompt:
          "Write a headline (≤8 words) and tagline (≤12 words) for AIVEXA, an agency that builds premium websites for local Indian businesses in minutes.",
        maxTokens: 4000,
      },
      testSchema
    );
    return {
      ok: true,
      provider: result.completion.provider,
      model: result.completion.model,
      latencyMs: result.completion.latencyMs,
      tokensIn: result.totalTokensIn,
      tokensOut: result.totalTokensOut,
      headline: result.value.headline,
      tagline: result.value.tagline,
      providersConfigured: providerNames,
    };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

// ── Prompt templates ────────────────────────────────────────────────

const promptSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Key: lowercase letters, digits and underscores only"),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80),
  tone: z.string().trim().max(40),
  system_prompt: z.string().trim().min(10, "System prompt is too short").max(20000),
  user_prompt: z.string().trim().max(20000),
});

/** Editing a prompt always creates a new version (old ones stay for rollback). */
export async function savePromptVersionAction(input: unknown): Promise<AiActionResult> {
  const parsed = promptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid prompt" };
  }
  try {
    const { supabase, user } = await requireUser();
    const saved = await createPromptVersion(supabase, {
      key: parsed.data.key,
      name: parsed.data.name,
      category: parsed.data.category || null,
      tone: parsed.data.tone || null,
      system_prompt: parsed.data.system_prompt,
      user_prompt: parsed.data.user_prompt || null,
      created_by: user.id,
    });
    revalidatePath("/settings/prompts");
    return { ok: true, message: `Saved "${parsed.data.key}" as version ${saved.version}.` };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
