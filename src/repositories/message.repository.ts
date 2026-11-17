import { pool } from "../config/database.js";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageStatus = "pending" | "completed" | "failed";

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  provider: string | null;
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface CreateMessageInput {
  conversationId: string;
  userId: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  provider?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateExchangeInput {
  conversationId: string;
  userId: string;
  userContent: string;
  requestId: string;
}

export interface CreateExchangeResult {
  userMessage: MessageRecord;
  assistantMessage: MessageRecord;
  isDuplicate: boolean;
}

export interface ListMessagesOptions {
  limit?: number;
  before?: string;
}

export class ConversationArchivedError extends Error {
  constructor() {
    super("Conversation is archived.");
    this.name = "ConversationArchivedError";
  }
}

export class ConversationBusyError extends Error {
  constructor() {
    super("Conversation already has a pending assistant response.");
    this.name = "ConversationBusyError";
  }
}
export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key was already used with different content.");
    this.name = "IdempotencyConflictError";
  }
}
export class InvalidMessageCursorError extends Error {
  constructor() {
    super("Invalid message pagination cursor.");
    this.name = "InvalidMessageCursorError";
  }
}
export const messageRepository = {
  async create(input: CreateMessageInput): Promise<MessageRecord> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const conversationResult = await client.query(
        `SELECT id
         FROM conversations
         WHERE id = $1
           AND user_id = $2
         FOR UPDATE`,
        [input.conversationId, input.userId],
      );

      if (conversationResult.rowCount === 0) {
        throw new Error("Conversation not found.");
      }

      const messageResult = await client.query<MessageRecord>(
        `INSERT INTO messages (
          conversation_id,
          role,
          content,
          status,
          provider,
          model,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          input.conversationId,
          input.role,
          input.content,
          input.status ?? "completed",
          input.provider ?? null,
          input.model ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );

      await client.query(
        `UPDATE conversations
         SET last_message_at = GREATEST(
               last_message_at,
               clock_timestamp()
             ),
             updated_at = clock_timestamp()
         WHERE id = $1
           AND user_id = $2`,
        [input.conversationId, input.userId],
      );

      await client.query("COMMIT");

      return messageResult.rows[0]!;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async createExchange(
    input: CreateExchangeInput,
  ): Promise<CreateExchangeResult> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const conversationResult = await client.query<{
        id: string;
        status: string;
      }>(
        `SELECT id, status
         FROM conversations
         WHERE id = $1
           AND user_id = $2
         FOR UPDATE`,
        [input.conversationId, input.userId],
      );

      const conversation = conversationResult.rows[0];

      if (!conversation) {
        throw new Error("Conversation not found.");
      }

      // Check for an existing request before checking pending messages.
      const existingResult = await client.query<MessageRecord>(
        `SELECT *
         FROM messages
         WHERE conversation_id = $1
           AND request_id = $2
           AND role IN ('user', 'assistant')
         ORDER BY CASE role WHEN 'user' THEN 0 ELSE 1 END`,
        [input.conversationId, input.requestId],
      );

      if (existingResult.rowCount && existingResult.rowCount > 0) {
        const userMessage = existingResult.rows.find(
          (message) => message.role === "user",
        );

        const assistantMessage = existingResult.rows.find(
          (message) => message.role === "assistant",
        );

        if (!userMessage || !assistantMessage) {
          throw new Error("INCOMPLETE_IDEMPOTENCY_RECORD");
        }

        if (userMessage.content !== input.userContent) {
          throw new IdempotencyConflictError();
        }

        await client.query("COMMIT");

        return {
          userMessage,
          assistantMessage,
          isDuplicate: true,
        };
      }

      if (conversation.status !== "active") {
        throw new ConversationArchivedError();
      }

      const pendingResult = await client.query(
        `SELECT id
         FROM messages
         WHERE conversation_id = $1
           AND role = 'assistant'
           AND status = 'pending'
         LIMIT 1`,
        [input.conversationId],
      );

      if (pendingResult.rowCount && pendingResult.rowCount > 0) {
        throw new ConversationBusyError();
      }

      const userResult = await client.query<MessageRecord>(
        `INSERT INTO messages (
          conversation_id,
          request_id,
          role,
          content,
          status,
          created_at
        )
        VALUES ($1, $2, 'user', $3, 'completed', clock_timestamp())
        RETURNING *`,
        [input.conversationId, input.requestId, input.userContent],
      );

      const assistantResult = await client.query<MessageRecord>(
        `INSERT INTO messages (
          conversation_id,
          request_id,
          role,
          content,
          status,
          created_at
        )
        VALUES (
          $1,
          $2,
          'assistant',
          '',
          'pending',
          GREATEST(
            clock_timestamp(),
            (
              SELECT created_at + INTERVAL '1 microsecond'
              FROM messages
              WHERE id = $3
            )
          )
        )
        RETURNING *`,
        [input.conversationId, input.requestId, userResult.rows[0]!.id],
      );

      await client.query(
        `UPDATE conversations
         SET last_message_at = clock_timestamp(),
             updated_at = clock_timestamp()
         WHERE id = $1
           AND user_id = $2`,
        [input.conversationId, input.userId],
      );

      await client.query("COMMIT");

      return {
        userMessage: userResult.rows[0]!,
        assistantMessage: assistantResult.rows[0]!,
        isDuplicate: false,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async findAllByConversationId(
    conversationId: string,
    userId: string,
    options: ListMessagesOptions = {},
  ): Promise<MessageRecord[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

    if (options.before) {
      const cursorResult = await pool.query(
        `SELECT m.id
       FROM messages m
       INNER JOIN conversations c
         ON c.id = m.conversation_id
       WHERE m.id = $1
         AND c.id = $2
         AND c.user_id = $3`,
        [options.before, conversationId, userId],
      );

      if (cursorResult.rowCount === 0) {
        throw new InvalidMessageCursorError();
      }
    }

    const values: unknown[] = [conversationId, userId, limit];

    let beforeCondition = "";

    if (options.before) {
      values.push(options.before);

      beforeCondition = `AND (m.created_at, m.id) < (
      SELECT cursor_message.created_at, cursor_message.id
      FROM messages cursor_message
      WHERE cursor_message.id = $4
        AND cursor_message.conversation_id = c.id
    )`;
    }

    const result = await pool.query<MessageRecord>(
      `SELECT m.*
     FROM messages m
     INNER JOIN conversations c
       ON c.id = m.conversation_id
     WHERE c.id = $1
       AND c.user_id = $2
       ${beforeCondition}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $3`,
      values,
    );

    return result.rows.reverse();
  },

  async completeAssistantMessage(
    messageId: string,
    conversationId: string,
    userId: string,
    input: {
      content: string;
      provider: string;
      model: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<MessageRecord | null> {
    const result = await pool.query<MessageRecord>(
      `UPDATE messages m
       SET content = $4,
           status = 'completed',
           provider = $5,
           model = $6,
           metadata = $7
       FROM conversations c
       WHERE m.id = $1
         AND m.conversation_id = $2
         AND m.role = 'assistant'
         AND m.status = 'pending'
         AND c.id = m.conversation_id
         AND c.user_id = $3
       RETURNING m.*`,
      [
        messageId,
        conversationId,
        userId,
        input.content,
        input.provider,
        input.model,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return result.rows[0] ?? null;
  },

  async failAssistantMessage(
    messageId: string,
    conversationId: string,
    userId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<MessageRecord | null> {
    const result = await pool.query<MessageRecord>(
      `UPDATE messages m
       SET content = $4,
           status = 'failed',
           metadata = $5
       FROM conversations c
       WHERE m.id = $1
         AND m.conversation_id = $2
         AND m.role = 'assistant'
         AND m.status = 'pending'
         AND c.id = m.conversation_id
         AND c.user_id = $3
       RETURNING m.*`,
      [
        messageId,
        conversationId,
        userId,
        "پاسخ دستیار تولید نشد.",
        JSON.stringify(metadata),
      ],
    );

    return result.rows[0] ?? null;
  },

  async updateStatus(
    messageId: string,
    conversationId: string,
    userId: string,
    status: MessageStatus,
  ): Promise<MessageRecord | null> {
    const result = await pool.query<MessageRecord>(
      `UPDATE messages m
       SET status = $4
       FROM conversations c
       WHERE m.id = $1
         AND m.conversation_id = $2
         AND c.id = m.conversation_id
         AND c.user_id = $3
       RETURNING m.*`,
      [messageId, conversationId, userId, status],
    );

    return result.rows[0] ?? null;
  },
  async recoverPendingAssistantMessages(): Promise<number> {
    const result = await pool.query(
      `UPDATE messages
       SET status = 'failed',
           content = 'پاسخ دستیار به دلیل توقف سرور تولید نشد.',
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'error', 'SERVER_RESTARTED',
                  'recoveredAt', clock_timestamp()
                )
       WHERE role = 'assistant'
         AND status = 'pending'
       RETURNING id`,
    );

    return result.rowCount ?? 0;
  },
};
