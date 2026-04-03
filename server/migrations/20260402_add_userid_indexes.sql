-- Add userId indexes to high-query tables for performance
-- These prevent full table scans on per-user queries

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_songs_user_id ON songs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_project_id ON tracks(project_id);
