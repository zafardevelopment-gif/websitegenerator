export type AiProviderName = "anthropic" | "gemini" | "openai_compat";

export interface AiRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  /** Ask the provider for JSON-only output (mime/format hints where supported). */
  json?: boolean;
}

export interface AiCompletion {
  text: string;
  provider: AiProviderName;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

/** One attempt against one provider — success or failure — for usage logging. */
export interface AiAttempt {
  provider: AiProviderName;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  success: boolean;
  error: string | null;
}

export type UsageListener = (attempt: AiAttempt) => void | Promise<void>;

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: AiProviderName,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  complete(request: AiRequest): Promise<AiCompletion>;
}
