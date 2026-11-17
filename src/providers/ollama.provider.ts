import type {
  AICompletionOptions,
  AICompletionResult,
  AIProvider,
} from "./ai-provider.interface.js";

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
    thinking?: string;
  };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";

  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = (
      process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
    ).replace(/\/+$/, "");

    this.model = process.env.OLLAMA_MODEL || "qwen3:14b-q4_K_M";
  }

  getModel(): string {
    return this.model;
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    if (options.messages.length === 0) {
      throw new Error("At least one message is required");
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs ?? 180000);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          think: false,
          keep_alive: "5m",
          ...(options.responseFormat === "json" ? { format: "json" } : {}),
          messages: options.messages,
          options: {
            temperature: options.temperature ?? 0.45,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Ollama HTTP ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as OllamaChatResponse;

      if (!result.message?.content?.trim()) {
        throw new Error("Ollama returned an empty response");
      }

      return {
        content: result.message.content,
        provider: this.name,
        model: result.model || this.model,
        usage: {
          promptTokens: result.prompt_eval_count,
          completionTokens: result.eval_count,
          totalTokens:
            result.prompt_eval_count !== undefined &&
            result.eval_count !== undefined
              ? result.prompt_eval_count + result.eval_count
              : undefined,
        },
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Ollama request timed out");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const ollamaProvider = new OllamaProvider();
