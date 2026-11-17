interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
    thinking?: string;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export class OllamaService {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = (
      process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
    ).replace(/\/+$/, '');

    this.model = process.env.OLLAMA_MODEL || 'qwen3:14b-q4_K_M';
  }

  async generateJson({
    systemPrompt,
    userPrompt,
    timeoutMs = 180000,
  }: GenerateOptions): Promise<Record<string, unknown>> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          think: false,
          format: 'json',
          keep_alive: '5m',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          options: {
            temperature: 0.45,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Ollama HTTP ${response.status}: ${errorText}`,
        );
      }

      const result = (await response.json()) as OllamaChatResponse;

      if (!result.message?.content) {
        throw new Error('Ollama returned an empty response');
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(result.message.content);
      } catch {
        throw new Error(
          'Model returned invalid JSON: ' + result.message.content.slice(0, 300),
        );
      }

      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        throw new Error('Model response must be a JSON object');
      }

      return parsed as Record<string, unknown>;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Ollama request timed out');
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const ollamaService = new OllamaService();

