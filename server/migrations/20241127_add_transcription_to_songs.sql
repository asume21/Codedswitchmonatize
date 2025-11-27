-- Add transcription columns to songs table
-- Run this migration to enable transcription persistence

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMP;

-- Add index for faster queries on transcription status
CREATE INDEX IF NOT EXISTS idx_songs_transcription_status ON songs(transcription_status);

-- Comment explaining the columns
COMMENT ON COLUMN songs.transcription IS 'Full transcription text from audio-to-text conversion';
COMMENT ON COLUMN songs.transcription_status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN songs.transcribed_at IS 'Timestamp when transcription was completed';
