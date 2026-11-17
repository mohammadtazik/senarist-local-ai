
import type {
  AICompletionOptions,
  AICompletionResult,
  AIProvider,
} from "../providers/ai-provider.interface.js";

import { ollamaProvider } from "../providers/ollama.provider.js";
import { openRouterProvider } from "../providers/openrouter.provider.js";

function createAIProvider(): AIProvider {
  const providerName = (
    process.env.AI_PROVIDER || "ollama"
  ).trim().toLowerCase();

  switch (providerName) {
    case "ollama":
      return ollamaProvider;

    case "openrouter":
      return openRouterProvider;

    default:
      throw new Error(
        `Unsupported AI_PROVIDER "${providerName}". ` +
        `Supported providers: ollama, openrouter`,
      );
  }
}

export class AIOrchestratorService {
  constructor(
    private readonly provider: AIProvider = createAIProvider(),
  ) {}

  getInfo(): { provider: string; model: string } {
    return {
      provider: this.provider.name,
      model: this.provider.getModel(),
    };
  }

  async complete(
    options: AICompletionOptions,
  ): Promise<AICompletionResult> {
    // OpenRouter is the primary provider.
    if (this.provider.name === "openrouter") {
      try {
        
        const result = await openRouterProvider.complete(options);

        console.info(
          `[AI] Primary provider succeeded: ${result.provider}/${result.model}`,
        );

        return result;
      } catch (primaryError) {
        const errorMessage =
          primaryError instanceof Error
            ? primaryError.message
            : String(primaryError);

        console.warn(
          `[AI] OpenRouter failed. Switching to Ollama. Reason: ${errorMessage}`,
        );

        try {
          const fallbackResult =
            await ollamaProvider.complete(options);

          console.info(
            `[AI] Fallback provider succeeded: ${fallbackResult.provider}/${fallbackResult.model}`,
          );

          return fallbackResult;
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError);

          console.error(
            `[AI] Both providers failed. OpenRouter: ${errorMessage}. Ollama: ${fallbackMessage}`,
          );

          throw new Error(
            "AI_SERVICE_UNAVAILABLE: OpenRouter and Ollama both failed.",
          );
        }
      }
    }

    // If Ollama is configured as primary, use it directly.
    return this.provider.complete(options);
  }
}

export const aiOrchestrator = new AIOrchestratorService();
