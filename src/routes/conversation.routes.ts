import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.middleware.js";
import {
  conversationService,
  ConversationNotFoundError,
  BrandProfileNotFoundError,
} from "../services/conversation.service.js";
import {
  conversationManagerService,
  AIResponseGenerationError,
  ConversationBrandProfileError,
} from "../services/conversation-manager.service.js";

import {
  ConversationArchivedError,
  ConversationBusyError,
  InvalidMessageCursorError,
  IdempotencyConflictError,
} from "../repositories/message.repository.js";

const router = Router();

router.use(requireAuth);

const createConversationSchema = z
  .object({
    type: z.enum(["general", "content", "workflow"]).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    useBrandProfile: z.boolean().optional(),
  })
  .strict();

const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().uuid().optional(),
});
const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(8000),
  })
  .strict();
function handleServiceError(error: unknown, res: import("express").Response) {
  if (
    error instanceof ConversationNotFoundError ||
    error instanceof BrandProfileNotFoundError
  ) {
    return res.status(404).json({
      success: false,
      error: error.message,
    });
  }
  if (error instanceof IdempotencyConflictError) {
    return res.status(409).json({
      success: false,
      error: "Idempotency key was already used with different content",
    });
  }

  if (
    error instanceof ConversationArchivedError ||
    error instanceof ConversationBusyError ||
    error instanceof ConversationBrandProfileError
  ) {
    return res.status(409).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof InvalidMessageCursorError) {
    return res.status(400).json({
      success: false,
      error: "Invalid message pagination cursor",
    });
  }

  if (error instanceof AIResponseGenerationError) {
    return res.status(502).json({
      success: false,
      error: "AI response generation failed",
    });
  }

  if (
    error instanceof Error &&
    (error.message === "INVALID_CONVERSATION_TITLE" ||
      error.message === "INVALID_MESSAGE_CONTENT")
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid request data",
    });
  }

  console.error("Conversation API error:", error);

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}
// POST /api/conversations
router.post("/", async (req, res) => {
  const validation = createConversationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid conversation data",
      details: validation.error.issues,
    });
  }

  try {
    const userId = res.locals.authUser.id;

    const conversation = await conversationService.create(
      userId,
      validation.data,
    );

    return res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    return handleServiceError(error, res);
  }
});

// GET /api/conversations
router.get("/", async (req, res) => {
  const validation = listQuerySchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid pagination parameters",
      details: validation.error.issues,
    });
  }

  try {
    const userId = res.locals.authUser.id;

    const conversations = await conversationService.list(
      userId,
      validation.data,
    );

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    return handleServiceError(error, res);
  }
});

// POST /api/conversations/:id/messages
router.post("/:id/messages", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid conversation ID",
    });
  }

  const validation = sendMessageSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid message data",
      details: validation.error.issues,
    });
  }

  try {
    const userId = res.locals.authUser.id;

    const requestId = z
      .string()
      .uuid()
      .safeParse(req.header("Idempotency-Key"));

    if (!requestId.success) {
      return res.status(400).json({
        success: false,
        error: "A valid Idempotency-Key header is required",
      });
    }

    const result = await conversationManagerService.sendMessage(
      userId,
      id.data,
      {
        ...validation.data,
        requestId: requestId.data,
      },
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleServiceError(error, res);
  }
});

// GET /api/conversations/:id
router.get("/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid conversation ID",
    });
  }

  try {
    const userId = res.locals.authUser.id;

    const conversation = await conversationService.get(userId, id.data);

    return res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    return handleServiceError(error, res);
  }
});

// PATCH /api/conversations/:id
router.patch("/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid conversation ID",
    });
  }

  const validation = updateConversationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid update data",
      details: validation.error.issues,
    });
  }

  try {
    const userId = res.locals.authUser.id;

    const conversation = await conversationService.update(
      userId,
      id.data,
      validation.data,
    );

    return res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    return handleServiceError(error, res);
  }
});

// DELETE /api/conversations/:id
router.delete("/:id", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid conversation ID",
    });
  }

  try {
    const userId = res.locals.authUser.id;

    await conversationService.delete(userId, id.data);

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    return handleServiceError(error, res);
  }
});

// GET /api/conversations/:id/messages
router.get("/:id/messages", async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);

  if (!id.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid conversation ID",
    });
  }

  const validation = messagesQuerySchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid message pagination parameters",
      details: validation.error.issues,
    });
  }

  try {
    const userId = res.locals.authUser.id;

    const messages = await conversationService.listMessages(
      userId,
      id.data,
      validation.data.limit,
      validation.data.before,
    );

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    return handleServiceError(error, res);
  }
});

export default router;
