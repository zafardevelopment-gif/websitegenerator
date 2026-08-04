import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod/v4";

import {
  AiProviderError,
  type AiCompletion,
  type AiProvider,
  type AiRequest,
} from "../types";

/**
 * Claude — primary content engine. Uses the official SDK.
 * Opus 4.8 notes: adaptive thinking only, no temperature/top_p (400 if sent).
 */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly effort: "low" | "medium" | "high" = "medium"
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
  }

  async complete(request: AiRequest): Promise<AiCompletion> {
    const started = Date.now();
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        thinking: { type: "adaptive" },
        output_config: { effort: this.effort },
        messages: [{ role: "user", content: request.prompt }],
      });

      if (response.stop_reason === "refusal") {
        throw new AiProviderError("Claude declined the request (refusal).", this.name, false);
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        provider: this.name,
        model: this.model,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      throw this.wrap(error);
    }
  }

  /**
   * Schema-constrained generation via structured outputs
   * (client.messages.parse + zodOutputFormat). Returns the parsed value and
   * completion metadata. Throws AiProviderError on failure; callers fall
   * back to the generic text + repair-loop path.
   */
  async completeStructured<T>(
    request: AiRequest,
    schema: ZodType<T>
  ): Promise<{ value: T; completion: AiCompletion }> {
    const started = Date.now();
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        thinking: { type: "adaptive" },
        output_config: {
          effort: this.effort,
          format: zodOutputFormat(schema),
        },
        messages: [{ role: "user", content: request.prompt }],
      });

      if (response.stop_reason === "refusal") {
        throw new AiProviderError("Claude declined the request (refusal).", this.name, false);
      }

      const completion: AiCompletion = {
        text: response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join(""),
        provider: this.name,
        model: this.model,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        latencyMs: Date.now() - started,
      };

      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new AiProviderError(
          "Structured output parse returned null (likely max_tokens truncation).",
          this.name,
          true
        );
      }
      return { value: response.parsed_output, completion };
    } catch (error) {
      throw this.wrap(error);
    }
  }

  private wrap(error: unknown): AiProviderError {
    if (error instanceof AiProviderError) return error;
    if (error instanceof Anthropic.RateLimitError) {
      return new AiProviderError(`Claude rate limited: ${error.message}`, this.name, true);
    }
    if (error instanceof Anthropic.InternalServerError) {
      return new AiProviderError(`Claude server error: ${error.message}`, this.name, true);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new AiProviderError(`Claude connection error: ${error.message}`, this.name, true);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return new AiProviderError(
        "Claude API key is invalid — check Settings → API Keys.",
        this.name,
        false
      );
    }
    if (error instanceof Anthropic.APIError) {
      return new AiProviderError(`Claude API error: ${error.message}`, this.name, false);
    }
    return new AiProviderError(
      error instanceof Error ? error.message : "Unknown Claude error",
      this.name,
      false
    );
  }
}
