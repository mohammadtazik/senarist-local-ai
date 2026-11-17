import { aiOrchestrator } from "./ai-orchestrator.service.js";

interface GenerateJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export class AIJsonService {
  async generateJson({
    systemPrompt,
    userPrompt,
    timeoutMs = 180000,
  }: GenerateJsonOptions): Promise<Record<string, unknown>> {
    const completion = await aiOrchestrator.complete({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.45,
      timeoutMs,
      responseFormat: "json",
    });

    if (!completion.content.trim()) {
      throw new Error(
        `${completion.provider} returned an empty response`,
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(completion.content);
    } catch {
      throw new Error(
        `${completion.provider} returned invalid JSON: ${
          completion.content.slice(0, 300)
        }`,
      );
    }

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("AI response must be a JSON object");
    }

    return parsed as Record<string, unknown>;
  }
}

export const aiJsonService = new AIJsonService();
