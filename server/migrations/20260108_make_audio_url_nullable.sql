-- Migration: Make audio_url nullable for MIDI/piano tracks
-- Date: 2026-01-08
-- Description: MIDI and piano roll tracks don't have audio URLs, only note data stored in metadata

-- Make audio_url column nullable
ALTER TABLE tracks ALTER COLUMN audio_url DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN tracks.audio_url IS 'Audio file URL - nullable for MIDI/piano tracks which store notes in metadata';
