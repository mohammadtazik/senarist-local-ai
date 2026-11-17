
BEGIN;

-- Add a durable request identifier to messages.
ALTER TABLE messages
ADD COLUMN request_id UUID NULL;

-- Each request can have one user message and one assistant message
-- within a conversation.
CREATE UNIQUE INDEX messages_conversation_request_role_unique
ON messages (conversation_id, request_id, role)
WHERE request_id IS NOT NULL
  AND role IN ('user', 'assistant');

-- Record migration.
INSERT INTO schema_migrations (version)
VALUES ('003_message_idempotency');

COMMIT;
