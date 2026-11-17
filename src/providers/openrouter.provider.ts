import type {
  AICompletionOptions,
  AICompletionResult,
  AIProvider,
} from "./ai-provider.interface.js";

interface OpenRouterChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  private readonly baseUrl = "https://openrouter.ai/api/v1";

  getModel(): string {
    return process.env.OPENROUTER_MODEL || "not-configured";
  }

  async complete(
    options: AICompletionOptions,
  ): Promise<AICompletionResult> {
    if (options.messages.length === 0) {
      throw new Error("At least one message is required");
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL;

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    if (!model) {
      throw new Error("OPENROUTER_MODEL is not configured");
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs ?? 180000);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      const siteUrl = process.env.OPENROUTER_SITE_URL;
      const siteName = process.env.OPENROUTER_SITE_NAME;

      if (siteUrl) {
        headers["HTTP-Referer"] = siteUrl;
      }

      if (siteName) {
        headers["X-Title"] = siteName;
      }

      const response = await fetch(
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: options.messages,
            temperature: options.temperature ?? 0.45,
            stream: false,
            ...(options.responseFormat === "json"
              ? { response_format: { type: "json_object" } }
              : {}),
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `OpenRouter HTTP ${response.status}: ${errorText}`,
        );
      }

      const result =
        (await response.json()) as OpenRouterChatResponse;

      const content = result.choices?.[0]?.message?.content;

      if (typeof content !== "string" || !content.trim()) {
        throw new Error(
          "OpenRouter returned an empty or invalid response",
        );
      }

      return {
        content,
        provider: this.name,
        model: result.model || model,
        usage: {
          promptTokens: result.usage?.prompt_tokens,
          completionTokens: result.usage?.completion_tokens,
          totalTokens: result.usage?.total_tokens,
        },
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("OpenRouter request timed out");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const openRouterProvider = new OpenRouterProvider();
