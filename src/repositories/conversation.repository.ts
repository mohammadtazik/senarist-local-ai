import { pool } from "../config/database.js";

export type ConversationType = "general" | "content" | "workflow";

export type ConversationStatus = "active" | "archived";

export interface ConversationRecord {
  id: string;
  user_id: string;
  brand_profile_id: string | null;
  title: string;
  type: ConversationType;
  status: ConversationStatus;
  context: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
}

export interface CreateConversationInput {
  userId: string;
  brandProfileId?: string | null;
  title?: string;
  type?: ConversationType;
}

export interface UpdateConversationInput {
  title?: string;
  status?: ConversationStatus;
  context?: Record<string, unknown>;
}

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
}

export const conversationRepository = {
  async create(input: CreateConversationInput): Promise<ConversationRecord> {
    const result = await pool.query<ConversationRecord>(
      `INSERT INTO conversations (
        user_id,
        brand_profile_id,
        title,
        type
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        input.userId,
        input.brandProfileId ?? null,
        input.title ?? "گفتگوی جدید",
        input.type ?? "general",
      ],
    );

    return result.rows[0]!;
  },

  async findByIdAndUserId(
    conversationId: string,
    userId: string,
  ): Promise<ConversationRecord | null> {
    const result = await pool.query<ConversationRecord>(
      `SELECT *
       FROM conversations
       WHERE id = $1
         AND user_id = $2
       LIMIT 1`,
      [conversationId, userId],
    );

    return result.rows[0] ?? null;
  },

  async findAllByUserId(
    userId: string,
    options: ListConversationsOptions = {},
  ): Promise<ConversationRecord[]> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const offset = Math.max(options.offset ?? 0, 0);

    const result = await pool.query<ConversationRecord>(
      `SELECT *
       FROM conversations
       WHERE user_id = $1
       ORDER BY last_message_at DESC, id DESC
       LIMIT $2
       OFFSET $3`,
      [userId, limit, offset],
    );

    return result.rows;
  },

  async update(
    conversationId: string,
    userId: string,
    input: UpdateConversationInput,
  ): Promise<ConversationRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [conversationId, userId];

    const mapping = {
      title: "title",
      status: "status",
      context: "context",
    } as const;

    for (const key of Object.keys(mapping) as Array<keyof typeof mapping>) {
      const value = input[key];

      if (value !== undefined) {
        values.push(value);
        fields.push(`${mapping[key]} = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      return this.findByIdAndUserId(conversationId, userId);
    }

    const result = await pool.query<ConversationRecord>(
      `UPDATE conversations
       SET ${fields.join(", ")},
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      values,
    );

    return result.rows[0] ?? null;
  },

  async delete(conversationId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM conversations
       WHERE id = $1
         AND user_id = $2`,
      [conversationId, userId],
    );

    return (result.rowCount ?? 0) > 0;
  },
};
