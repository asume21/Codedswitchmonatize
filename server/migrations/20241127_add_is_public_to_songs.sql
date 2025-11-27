-- Adds the is_public column expected by @shared/schema.ts
ALTER TABLE songs
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
