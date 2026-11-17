export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  temperature?: number;
  timeoutMs?: number;
  responseFormat?: "json";
}

export interface AICompletionResult {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIProvider {
  readonly name: string;

  getModel(): string;

  complete(
    options: AICompletionOptions,
  ): Promise<AICompletionResult>;
}
