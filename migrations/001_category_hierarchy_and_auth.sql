
BEGIN;

-- Migration tracking
CREATE TABLE schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Add hierarchical category support.
ALTER TABLE categories
ADD COLUMN parent_id UUID NULL;

ALTER TABLE categories
ADD CONSTRAINT categories_parent_id_fkey
FOREIGN KEY (parent_id)
REFERENCES categories(id)
ON DELETE RESTRICT;

ALTER TABLE categories
ADD CONSTRAINT categories_not_own_parent
CHECK (parent_id IS DISTINCT FROM id);

CREATE INDEX categories_parent_id_idx
ON categories(parent_id);

-- Preserve global uniqueness of category names and slugs.

-- 2. Enforce email/password authentication.
ALTER TABLE users
ALTER COLUMN password_hash SET NOT NULL;

-- Record successful migration.
INSERT INTO schema_migrations (version)
VALUES ('001_category_hierarchy_and_auth');

COMMIT;
