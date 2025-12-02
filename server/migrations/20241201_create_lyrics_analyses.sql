-- Create table to persist lyric analysis results
CREATE TABLE IF NOT EXISTS lyrics_analyses (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR REFERENCES users(id),
    song_id VARCHAR REFERENCES songs(id) ON DELETE CASCADE,
    lyrics_id VARCHAR REFERENCES lyrics(id),
    content TEXT NOT NULL,
    analysis JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lyrics_analyses_song_id ON lyrics_analyses(song_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_analyses_user_id ON lyrics_analyses(user_id);
