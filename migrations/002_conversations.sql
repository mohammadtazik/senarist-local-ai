
BEGIN;

-- 1. Ensure composite key for secure brand profile ownership.
ALTER TABLE brand_profiles
ADD CONSTRAINT brand_profiles_id_user_id_unique
UNIQUE (id, user_id);

-- 2. Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    brand_profile_id UUID NULL,

    title VARCHAR(255) NOT NULL DEFAULT 'گفتگوی جدید',

    type VARCHAR(30) NOT NULL DEFAULT 'general',
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    context JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT conversations_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT conversations_brand_profile_fk
        FOREIGN KEY (brand_profile_id, user_id)
        REFERENCES brand_profiles(id, user_id)
        ON DELETE SET NULL (brand_profile_id),

    CONSTRAINT conversations_type_check
        CHECK (type IN ('general', 'content', 'workflow')),

    CONSTRAINT conversations_status_check
        CHECK (status IN ('active', 'archived')),

    CONSTRAINT conversations_context_object_check
        CHECK (jsonb_typeof(context) = 'object')
);


CREATE INDEX conversations_user_updated_idx
ON conversations(user_id, updated_at DESC);

CREATE INDEX conversations_brand_profile_id_idx
ON conversations(brand_profile_id);

-- 3. Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id UUID NOT NULL,

    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'completed',

    provider VARCHAR(50) NULL,
    model VARCHAR(100) NULL,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_conversation_fk
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE,

    CONSTRAINT messages_role_check
        CHECK (role IN ('user', 'assistant', 'system', 'tool')),

    CONSTRAINT messages_status_check
        CHECK (status IN ('pending', 'completed', 'failed')),

    CONSTRAINT messages_metadata_object_check
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX messages_conversation_created_idx
ON messages(conversation_id, created_at, id);

-- 4. Record migration
INSERT INTO schema_migrations (version)
VALUES ('002_conversations');

COMMIT;
