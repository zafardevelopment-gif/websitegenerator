import {
  AiProviderError,
  type AiCompletion,
  type AiProvider,
  type AiRequest,
} from "../types";

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string };
}

/** Gemini — automatic fallback when Claude is unavailable. */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async complete(request: AiRequest): Promise<AiCompletion> {
    const started = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            temperature: 0.7,
            ...(request.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });
    } catch (error) {
      throw new AiProviderError(
        `Gemini connection error: ${error instanceof Error ? error.message : "unknown"}`,
        this.name,
        true
      );
    }

    const payload = (await response.json().catch(() => ({}))) as GeminiResponse;

    if (!response.ok) {
      const message = payload.error?.message ?? `HTTP ${response.status}`;
      const retryable = response.status === 429 || response.status >= 500;
      throw new AiProviderError(`Gemini error: ${message}`, this.name, retryable);
    }

    const text =
      payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) {
      throw new AiProviderError(
        `Gemini returned no text (finishReason: ${payload.candidates?.[0]?.finishReason ?? "unknown"})`,
        this.name,
        true
      );
    }

    return {
      text,
      provider: this.name,
      model: this.model,
      tokensIn: payload.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: payload.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}
