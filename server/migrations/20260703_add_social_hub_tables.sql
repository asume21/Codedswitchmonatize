-- Social Hub tables — additive & idempotent (CREATE TABLE IF NOT EXISTS).
--
-- Root cause (confirmed from prod Railway logs 2026-07-03):
--   PostgresError: relation "social_posts" / "chat_messages" / "collab_invites"
--   does not exist. These tables are defined in shared/schema.ts but were never
--   pushed to the production database, so every Social Hub action 500s
--   (posting, feed load, chat, collab).
--
-- Safe to run against production: IF NOT EXISTS skips tables that already exist,
-- so only the missing ones are created. No ALTER/DROP — existing data untouched.
-- Column types/defaults mirror shared/schema.ts exactly.

CREATE TABLE IF NOT EXISTS user_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  display_name varchar,
  bio text,
  avatar_url varchar,
  website_url varchar,
  social_links jsonb,
  location varchar,
  favorite_genres text[],
  instruments text[],
  skill_level varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_shares (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar REFERENCES projects(id),
  shared_by_user_id varchar REFERENCES users(id),
  shared_with_user_id varchar REFERENCES users(id),
  permission varchar DEFAULT 'view',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_collaborations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar REFERENCES projects(id),
  user_id varchar REFERENCES users(id),
  role varchar DEFAULT 'collaborator',
  joined_at timestamp DEFAULT now(),
  last_active_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar REFERENCES projects(id),
  user_id varchar REFERENCES users(id),
  content text NOT NULL,
  parent_comment_id varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_likes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar REFERENCES projects(id),
  user_id varchar REFERENCES users(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_follows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id varchar REFERENCES users(id),
  following_id varchar REFERENCES users(id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  platform varchar NOT NULL,
  content text NOT NULL,
  type varchar NOT NULL,
  title varchar,
  url varchar,
  media_url varchar,
  project_id varchar REFERENCES projects(id),
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  views integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_connections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  platform varchar NOT NULL,
  platform_user_id varchar,
  platform_username varchar,
  access_token text,
  refresh_token text,
  connected boolean DEFAULT true,
  followers integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id varchar REFERENCES users(id),
  recipient_id varchar REFERENCES users(id),
  conversation_id varchar NOT NULL,
  content text NOT NULL,
  message_type varchar DEFAULT 'text',
  attachment_url varchar,
  read_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collab_invites (
  id serial PRIMARY KEY,
  from_user_id text NOT NULL,
  to_user_id text NOT NULL,
  project_id integer,
  type text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  expires_at timestamp
);
