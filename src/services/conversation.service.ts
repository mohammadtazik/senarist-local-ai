import { brandProfileRepository } from "../repositories/brand-profile.repository.js";
import {
  conversationRepository,
  type ConversationType,
  type ConversationStatus,
  type ConversationRecord,
  type UpdateConversationInput,
} from "../repositories/conversation.repository.js";
import { messageRepository } from "../repositories/message.repository.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found");
    this.name = "ConversationNotFoundError";
  }
}

export class BrandProfileNotFoundError extends Error {
  constructor() {
    super("Brand profile not found");
    this.name = "BrandProfileNotFoundError";
  }
}

export interface CreateConversationRequest {
  type?: ConversationType;
  title?: string;
  useBrandProfile?: boolean;
}

export interface ListConversationsRequest {
  limit?: number;
  offset?: number;
}

export interface UpdateConversationRequest {
  title?: string;
  status?: ConversationStatus;
}

function normalizePagination(limit?: number, offset?: number) {
  return {
    limit: Math.min(Math.max(limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
    offset: Math.max(offset ?? 0, 0),
  };
}

function normalizeTitle(title?: string): string | undefined {
  if (title === undefined) {
    return undefined;
  }

  const normalized = title.trim();

  if (!normalized || normalized.length > 255) {
    throw new Error("INVALID_CONVERSATION_TITLE");
  }

  return normalized;
}

export const conversationService = {
  async create(
    userId: string,
    input: CreateConversationRequest = {},
  ): Promise<ConversationRecord> {
    const title = normalizeTitle(input.title);

    let brandProfileId: string | null = null;

    if (input.useBrandProfile === true) {
      const profile = await brandProfileRepository.findByUserId(userId);

      if (!profile) {
        throw new BrandProfileNotFoundError();
      }

      brandProfileId = profile.id;
    }

    return conversationRepository.create({
      userId,
      brandProfileId,
      title,
      type: input.type ?? "general",
    });
  },

  async list(
    userId: string,
    options: ListConversationsRequest = {},
  ): Promise<ConversationRecord[]> {
    const pagination = normalizePagination(options.limit, options.offset);

    return conversationRepository.findAllByUserId(userId, pagination);
  },

  async get(
    userId: string,
    conversationId: string,
  ): Promise<ConversationRecord> {
    const conversation = await conversationRepository.findByIdAndUserId(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    return conversation;
  },

  async update(
    userId: string,
    conversationId: string,
    input: UpdateConversationRequest,
  ): Promise<ConversationRecord> {
    const updateData: UpdateConversationInput = {};

    if (input.title !== undefined) {
      updateData.title = normalizeTitle(input.title);
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    const conversation = await conversationRepository.update(
      conversationId,
      userId,
      updateData,
    );

    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    return conversation;
  },

  async archive(
    userId: string,
    conversationId: string,
  ): Promise<ConversationRecord> {
    return this.update(userId, conversationId, {
      status: "archived",
    });
  },

  async delete(userId: string, conversationId: string): Promise<void> {
    const deleted = await conversationRepository.delete(conversationId, userId);

    if (!deleted) {
      throw new ConversationNotFoundError();
    }
  },

  async listMessages(
    userId: string,
    conversationId: string,
    limit?: number,
    before?: string,
  ) {
    await this.get(userId, conversationId);

    return messageRepository.findAllByConversationId(conversationId, userId, {
      limit: Math.min(Math.max(limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
      before,
    });
  },
};
