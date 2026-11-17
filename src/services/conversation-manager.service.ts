import {
  conversationService,
  ConversationNotFoundError,
} from "./conversation.service.js";

import { brandProfileRepository } from "../repositories/brand-profile.repository.js";

import {
  messageRepository,
  ConversationArchivedError,
  ConversationBusyError,
  type MessageRecord,
} from "../repositories/message.repository.js";

import { aiOrchestrator } from "./ai-orchestrator.service.js";

import type { AIMessage } from "../providers/ai-provider.interface.js";

const HISTORY_LIMIT = 20;

export class AIResponseGenerationError extends Error {
  constructor() {
    super("AI response generation failed.");
    this.name = "AIResponseGenerationError";
  }
}

export class ConversationBrandProfileError extends Error {
  constructor() {
    super("The conversation brand profile is unavailable.");
    this.name = "ConversationBrandProfileError";
  }
}

export interface SendMessageInput {
  content: string;
  requestId: string;
}

export interface SendMessageResult {
  userMessage: MessageRecord;
  assistantMessage: MessageRecord;
}

function buildSystemPrompt(
  conversationType: string,
  profile: Awaited<ReturnType<typeof brandProfileRepository.findByUserId>>,
): string {
  const instructions = [
    "تو دستیار هوشمند اپلیکیشن سناریست هستی.",
    "همیشه به زبان فارسی پاسخ بده، مگر اینکه کاربر زبان دیگری درخواست کند.",
    "پاسخ‌ها باید دقیق، کاربردی، منسجم و متناسب با درخواست کاربر باشند.",
    "اطلاعات نامشخص را به‌عنوان واقعیت مطرح نکن.",
    "از تکرار غیرضروری مطالب خودداری کن.",
  ];

  if (conversationType === "content") {
    instructions.push(
      "تمرکز این گفتگو تولید و بهبود محتوای شبکه‌های اجتماعی است.",
      "در تولید محتوا به جذابیت، ارتباط با مخاطب هدف و هدف تجاری توجه کن.",
    );
  }

  if (conversationType === "workflow") {
    instructions.push(
      "تمرکز این گفتگو برنامه‌ریزی و مدیریت فرایندهای کاری است.",
      "پیشنهادها را به مراحل روشن و قابل اجرا تقسیم کن.",
    );
  }

  if (profile) {
    instructions.push(
      "",
      "اطلاعات برند کاربر:",
      `نوع کسب‌وکار: ${profile.business_type}`,
      `شناسه دسته‌بندی اصلی: ${profile.primary_category_id}`,
      `نام کاربری اینستاگرام: ${profile.instagram_handle || "ثبت نشده"}`,
      `مخاطبان هدف: ${profile.target_audience}`,
      `هدف کسب‌وکار: ${profile.goal}`,
      `لحن برند: ${profile.tone}`,
      "",
      "در پاسخ‌های مرتبط با کسب‌وکار و تولید محتوا، این اطلاعات را در نظر بگیر.",
      "اطلاعات برند را تغییر نده و جزئیات ثبت‌نشده را حدس نزن.",
    );
  }

  return instructions.join("\n");
}

function toAIHistory(messages: MessageRecord[]): AIMessage[] {
  return messages
    .filter(
      (message) =>
        message.status === "completed" &&
        (message.role === "user" || message.role === "assistant"),
    )
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
}

export const conversationManagerService = {
  async sendMessage(
    userId: string,
    conversationId: string,
    input: SendMessageInput,
  ): Promise<SendMessageResult> {
    const content = input.content.trim();

    if (!content || content.length > 8000) {
      throw new Error("INVALID_MESSAGE_CONTENT");
    }

    const conversation = await conversationService.get(userId, conversationId);

    let profile = null;

    if (conversation.brand_profile_id) {
      profile = await brandProfileRepository.findByUserId(userId);

      if (!profile || profile.id !== conversation.brand_profile_id) {
        throw new ConversationBrandProfileError();
      }
    }

    const exchange = await messageRepository.createExchange({
      conversationId,
      userId,
      userContent: content,
      requestId: input.requestId,
    });
    if (exchange.isDuplicate) {
      return {
        userMessage: exchange.userMessage,
        assistantMessage: exchange.assistantMessage,
      };
    }

    try {
      const history = await messageRepository.findAllByConversationId(
        conversationId,
        userId,
        {
          limit: HISTORY_LIMIT,
        },
      );

      const messages: AIMessage[] = [
        {
          role: "system",
          content: buildSystemPrompt(conversation.type, profile),
        },
        ...toAIHistory(history),
      ];

      const completion = await aiOrchestrator.complete({
        messages,
        temperature: 0.45,
        timeoutMs: 180000,
      });

      const assistantMessage = await messageRepository.completeAssistantMessage(
        exchange.assistantMessage.id,
        conversationId,
        userId,
        {
          content: completion.content,
          provider: completion.provider,
          model: completion.model,
          metadata: {
            usage: completion.usage ?? null,
          },
        },
      );

      if (!assistantMessage) {
        throw new Error("ASSISTANT_MESSAGE_UPDATE_FAILED");
      }

      return {
        userMessage: exchange.userMessage,
        assistantMessage,
      };
    } catch (error) {
      console.error("Conversation AI generation failed:", {
        conversationId,
        assistantMessageId: exchange.assistantMessage.id,
        error,
      });

      await messageRepository.failAssistantMessage(
        exchange.assistantMessage.id,
        conversationId,
        userId,
        {
          error: "AI_GENERATION_FAILED",
        },
      );

      throw new AIResponseGenerationError();
    }
  },
};
