import { toJSONSchema, type ZodType } from "zod/v4";

import { extractJson } from "./json";
import { AnthropicProvider } from "./providers/anthropic";
import {
  AiProviderError,
  type AiAttempt,
  type AiCompletion,
  type AiProvider,
  type AiRequest,
  type UsageListener,
} from "./types";

const RETRIES_PER_PROVIDER = 2;
const MAX_REPAIRS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StructuredResult<T> {
  value: T;
  completion: AiCompletion;
  /** Total across all attempts (failover + repairs). */
  totalTokensIn: number;
  totalTokensOut: number;
  repairs: number;
}

/**
 * Failover chain: Claude → Gemini → OpenAI-compatible.
 * Per provider: up to 2 retries with exponential backoff on retryable errors
 * (429/5xx/connection), then the next provider. Every attempt — success or
 * failure — is reported to the usage listener for cost logging.
 */
export class AiEngine {
  constructor(
    private readonly providers: AiProvider[],
    private readonly onUsage: UsageListener
  ) {
    if (providers.length === 0) {
      throw new Error(
        "No AI providers configured. Add an Anthropic or Gemini API key in Settings → API Keys."
      );
    }
  }

  private async report(attempt: AiAttempt): Promise<void> {
    try {
      await this.onUsage(attempt);
    } catch {
      // usage logging must never break generation
    }
  }

  private async tryProvider(provider: AiProvider, request: AiRequest): Promise<AiCompletion> {
    let lastError: AiProviderError | null = null;
    for (let attempt = 0; attempt <= RETRIES_PER_PROVIDER; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
      const started = Date.now();
      try {
        const completion = await provider.complete(request);
        await this.report({ ...completion, success: true, error: null });
        return completion;
      } catch (error) {
        const wrapped =
          error instanceof AiProviderError
            ? error
            : new AiProviderError(String(error), provider.name, false);
        lastError = wrapped;
        await this.report({
          provider: provider.name,
          model: provider.model,
          tokensIn: 0,
          tokensOut: 0,
          latencyMs: Date.now() - started,
          success: false,
          error: wrapped.message,
        });
        if (!wrapped.retryable) break;
      }
    }
    throw lastError ?? new AiProviderError("Provider failed", provider.name, false);
  }

  /** Plain text completion with failover. */
  async complete(request: AiRequest): Promise<AiCompletion> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        return await this.tryProvider(provider, request);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(`All AI providers failed: ${errors.join(" | ")}`);
  }

  /**
   * Structured generation validated against a Zod schema.
   * Claude uses native structured outputs (schema-constrained decoding);
   * if that path fails — and on Gemini/OpenAI-compatible — falls back to
   * JSON-mode text with an extract → validate → repair loop (max 2 repairs).
   */
  async generateStructured<T>(request: AiRequest, schema: ZodType<T>): Promise<StructuredResult<T>> {
    const errors: string[] = [];
    let totalIn = 0;
    let totalOut = 0;

    for (const provider of this.providers) {
      // Fast path: Claude structured outputs.
      if (provider instanceof AnthropicProvider) {
        const started = Date.now();
        try {
          const { value, completion } = await provider.completeStructured(request, schema);
          await this.report({ ...completion, success: true, error: null });
          return {
            value,
            completion,
            totalTokensIn: totalIn + completion.tokensIn,
            totalTokensOut: totalOut + completion.tokensOut,
            repairs: 0,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`anthropic structured: ${message}`);
          await this.report({
            provider: provider.name,
            model: provider.model,
            tokensIn: 0,
            tokensOut: 0,
            latencyMs: Date.now() - started,
            success: false,
            error: message,
          });
          // fall through to the generic path on the same provider
        }
      }

      // Generic path: JSON-mode text + repair loop.
      // Providers here (Gemini, OpenAI-compatible) don't get Claude's
      // schema-constrained decoding, so — unlike the fast path above — they
      // only ever see a prose description of the shape unless we hand them
      // the real JSON Schema. Without it they guess field names on complex
      // nested schemas (like SiteContent) and fail validation repeatedly,
      // exhausting all repair attempts. Appending the schema fixes this.
      let jsonSchemaText = "";
      try {
        jsonSchemaText = JSON.stringify(toJSONSchema(schema));
      } catch {
        // Some schema constructs (e.g. certain refinements) can't convert to
        // JSON Schema — fall back to the prose-only prompt in that case.
      }
      const schemaAppendix = jsonSchemaText
        ? `\n\nYour output MUST validate against this JSON Schema:\n${jsonSchemaText}`
        : "";

      try {
        let completion = await this.tryProvider(provider, {
          ...request,
          system: request.system + schemaAppendix,
          json: true,
        });
        totalIn += completion.tokensIn;
        totalOut += completion.tokensOut;

        for (let repair = 0; repair <= MAX_REPAIRS; repair++) {
          const parsed = extractJson(completion.text);
          const result = parsed === null ? null : schema.safeParse(parsed);

          if (result?.success) {
            return {
              value: result.data,
              completion,
              totalTokensIn: totalIn,
              totalTokensOut: totalOut,
              repairs: repair,
            };
          }
          if (repair === MAX_REPAIRS) break;

          const issues =
            parsed === null
              ? "The output was not valid JSON."
              : (result?.error.issues ?? [])
                  .slice(0, 12)
                  .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
                  .join("\n");

          completion = await this.tryProvider(provider, {
            system: request.system + schemaAppendix,
            maxTokens: request.maxTokens,
            json: true,
            prompt: [
              "Your previous response did not match the required JSON schema.",
              "Problems found:",
              issues,
              "",
              "Your previous response:",
              completion.text.slice(0, 12000),
              "",
              "Return the corrected, COMPLETE JSON object only — no prose, no code fences.",
            ].join("\n"),
          });
          totalIn += completion.tokensIn;
          totalOut += completion.tokensOut;
        }
        errors.push(`${provider.name}: output failed schema validation after ${MAX_REPAIRS} repairs`);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(`Structured generation failed on all providers: ${errors.join(" | ")}`);
  }
}
