import postgres from "postgres";

/**
 * Run database migrations on startup
 * This ensures the database schema is up to date
 */
export async function runMigrations() {
  // Prefer internal DATABASE_URL (free on Railway) over public URL (costs money)
  const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (!url) {
    console.log('No DATABASE_URL - skipping migrations');
    return;
  }

  console.log('Running database migrations...');
  
  const sql = postgres(url);
  
  try {
    // Migration: Add transcription columns to songs table
    await sql`
      ALTER TABLE songs 
      ADD COLUMN IF NOT EXISTS transcription TEXT,
      ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMP
    `;
    console.log('? Migration: transcription columns added to songs table');

    // Create index for transcription status
    await sql`
      CREATE INDEX IF NOT EXISTS idx_songs_transcription_status ON songs(transcription_status)
    `;
    console.log('? Migration: transcription_status index created');

    // Migration: user_subscriptions table ensured
    await sql`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        status TEXT,
        current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscription_id ON user_subscriptions(stripe_subscription_id)
    `;
    console.log('✅ Migration: user_subscriptions table ensured');

    // Migration: tracks table
    await sql`
      CREATE TABLE IF NOT EXISTS tracks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        project_id VARCHAR REFERENCES projects(id),
        song_id VARCHAR REFERENCES songs(id),
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        audio_url VARCHAR NOT NULL,
        position INTEGER DEFAULT 0,
        duration INTEGER,
        volume INTEGER DEFAULT 100,
        pan INTEGER DEFAULT 0,
        muted BOOLEAN DEFAULT false,
        solo BOOLEAN DEFAULT false,
        color VARCHAR,
        effects JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration: tracks table ensured');

    // Migration: jam_sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS jam_sessions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        host_id VARCHAR REFERENCES users(id),
        name VARCHAR NOT NULL,
        description TEXT,
        genre VARCHAR,
        bpm INTEGER DEFAULT 120,
        key_signature VARCHAR,
        is_public BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        max_participants INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP
      )
    `;
    console.log('✅ Migration: jam_sessions table ensured');

    // Migration: jam_contributions table
    await sql`
      CREATE TABLE IF NOT EXISTS jam_contributions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR REFERENCES jam_sessions(id) ON DELETE CASCADE,
        user_id VARCHAR REFERENCES users(id),
        track_id VARCHAR REFERENCES tracks(id),
        type VARCHAR NOT NULL,
        audio_url VARCHAR,
        position INTEGER DEFAULT 0,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration: jam_contributions table ensured');

    // Migration: jam_likes table
    await sql`
      CREATE TABLE IF NOT EXISTS jam_likes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR REFERENCES jam_sessions(id) ON DELETE CASCADE,
        contribution_id VARCHAR REFERENCES jam_contributions(id) ON DELETE CASCADE,
        user_id VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration: jam_likes table ensured');

    // Migration: Make audio_url nullable for MIDI/piano tracks
    await sql`
      ALTER TABLE tracks ALTER COLUMN audio_url DROP NOT NULL
    `;
    console.log('✅ Migration: audio_url made nullable for MIDI tracks');

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    // If columns already exist, that's fine
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('? Migrations: columns already exist, skipping');
    } else {
      console.error('? Migration error:', error);
    }
  } finally {
    await sql.end();
  }
}
