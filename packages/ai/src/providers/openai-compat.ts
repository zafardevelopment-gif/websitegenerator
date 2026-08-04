import {
  AiProviderError,
  type AiCompletion,
  type AiProvider,
  type AiRequest,
} from "../types";

interface OpenAiCompatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/** Optional third provider: any OpenAI-compatible /chat/completions host. */
export class OpenAiCompatProvider implements AiProvider {
  readonly name = "openai_compat" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async complete(request: AiRequest): Promise<AiCompletion> {
    const started = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
          ...(request.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (error) {
      throw new AiProviderError(
        `OpenAI-compatible connection error: ${error instanceof Error ? error.message : "unknown"}`,
        this.name,
        true
      );
    }

    const payload = (await response.json().catch(() => ({}))) as OpenAiCompatResponse;

    if (!response.ok) {
      const message = payload.error?.message ?? `HTTP ${response.status}`;
      const retryable = response.status === 429 || response.status >= 500;
      throw new AiProviderError(`OpenAI-compatible error: ${message}`, this.name, retryable);
    }

    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text) {
      throw new AiProviderError("OpenAI-compatible host returned no text", this.name, true);
    }

    return {
      text,
      provider: this.name,
      model: this.model,
      tokensIn: payload.usage?.prompt_tokens ?? 0,
      tokensOut: payload.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}
