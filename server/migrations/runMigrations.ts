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
    // Migration: Ensure core tables exist first (users, songs, projects)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        subscription_status TEXT,
        subscription_tier TEXT DEFAULT 'free',
        activation_key TEXT UNIQUE,
        activated_at TIMESTAMP,
        monthly_uploads INTEGER DEFAULT 0,
        monthly_generations INTEGER DEFAULT 0,
        last_usage_reset TIMESTAMP DEFAULT NOW(),
        credits INTEGER DEFAULT 10,
        total_credits_spent INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration: users table ensured');

    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        name TEXT NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration: projects table ensured');

    await sql`
      CREATE TABLE IF NOT EXISTS songs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT,
        genre TEXT,
        audio_url TEXT,
        cover_image_url TEXT,
        duration INTEGER,
        bpm INTEGER,
        key TEXT,
        is_public BOOLEAN DEFAULT false,
        play_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration: songs table ensured');

    await sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        reason TEXT NOT NULL,
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration: credit_transactions table ensured');

    await sql`
      CREATE TABLE IF NOT EXISTS processed_stripe_events (
        event_id VARCHAR PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id VARCHAR,
        payment_intent_id TEXT,
        processed_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_payment_intent
      ON processed_stripe_events(payment_intent_id)
    `;
    console.log('✅ Migration: processed_stripe_events table ensured');

    await sql`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire)
    `;
    console.log('✅ Migration: session table ensured');

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

    // Migration: WebEar API keys table. Production hit /api/webear-keys/reveal
    // before this table was guaranteed on boot, which turned a missing-table
    // SQL error into a 5xx/edge 502 and left the browser bridge unable to auth.
    await sql`
      CREATE TABLE IF NOT EXISTS webear_api_keys (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL UNIQUE,
        name VARCHAR DEFAULT 'Default',
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_webear_api_keys_user_active
      ON webear_api_keys(user_id, is_active, created_at DESC)
    `;
    console.log('✅ Migration: webear_api_keys table ensured');

    // Migration: Persist short-lived WebEar captures in Postgres so Railway
    // edge/load balancing cannot lose them between the blob upload request and
    // the later analyze request that may hit a different app instance.
    await sql`
      CREATE TABLE IF NOT EXISTS webear_captures (
        capture_id VARCHAR PRIMARY KEY,
        content_type TEXT NOT NULL,
        audio_data BYTEA,
        audio_base64 TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      ALTER TABLE webear_captures
      ADD COLUMN IF NOT EXISTS audio_base64 TEXT
    `;
    await sql`
      ALTER TABLE webear_captures
      ALTER COLUMN audio_data DROP NOT NULL
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_webear_captures_expires_at
      ON webear_captures(expires_at)
    `;
    console.log('✅ Migration: webear_captures table ensured');

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

    // Migration: voice_convert_jobs table
    await sql`
      CREATE TABLE IF NOT EXISTS voice_convert_jobs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        status VARCHAR NOT NULL DEFAULT 'queued',
        execution_mode VARCHAR NOT NULL DEFAULT 'cloud',
        stem_mode INTEGER NOT NULL DEFAULT 2,
        provider VARCHAR NOT NULL DEFAULT 'elevenlabs',
        voice_id VARCHAR NOT NULL,
        pitch_correct BOOLEAN DEFAULT false,
        source_file_name VARCHAR,
        source_url VARCHAR,
        vocal_stem_url VARCHAR,
        instrumental_stem_url VARCHAR,
        drums_stem_url VARCHAR,
        bass_stem_url VARCHAR,
        other_stem_url VARCHAR,
        converted_vocal_url VARCHAR,
        corrected_vocal_url VARCHAR,
        remix_url VARCHAR,
        credits_cost INTEGER DEFAULT 0,
        vendor_cost_cents INTEGER DEFAULT 0,
        error TEXT,
        failed_stage VARCHAR,
        retry_count INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_voice_convert_jobs_user_id ON voice_convert_jobs(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_voice_convert_jobs_status ON voice_convert_jobs(status)
    `;
    console.log('✅ Migration: voice_convert_jobs table ensured');

    // Migration: user_api_keys table
    await sql`
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        service VARCHAR NOT NULL,
        encrypted_key TEXT NOT NULL,
        key_hint VARCHAR,
        is_valid BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, service)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id)
    `;
    console.log('✅ Migration: user_api_keys table ensured');

    // Migration: organism_sessions table (Section 07 — Session Capture)
    await sql`
      CREATE TABLE IF NOT EXISTS organism_sessions (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id            VARCHAR(36) NOT NULL UNIQUE,
        user_id               VARCHAR(255) NOT NULL,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duration_ms           INTEGER NOT NULL,
        dominant_mode         VARCHAR(20) NOT NULL,
        avg_pulse             NUMERIC(6,2) NOT NULL,
        avg_bounce            NUMERIC(5,4) NOT NULL,
        avg_swing             NUMERIC(5,4) NOT NULL,
        avg_presence          NUMERIC(5,4) NOT NULL,
        avg_density           NUMERIC(5,4) NOT NULL,
        time_in_flow_ms       INTEGER NOT NULL DEFAULT 0,
        flow_percentage       NUMERIC(5,4) NOT NULL DEFAULT 0,
        longest_flow_streak   INTEGER NOT NULL DEFAULT 0,
        transition_count      INTEGER NOT NULL DEFAULT 0,
        cadence_lock_events   INTEGER NOT NULL DEFAULT 0,
        avg_syllabic_density  NUMERIC(5,2) NOT NULL DEFAULT 0,
        pitch_center          NUMERIC(8,2) NOT NULL DEFAULT 0,
        energy_profile        VARCHAR(10) NOT NULL DEFAULT 'cool',
        session_dna           JSONB NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_organism_sessions_user_id ON organism_sessions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_organism_sessions_created_at ON organism_sessions(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_organism_sessions_dominant_mode ON organism_sessions(dominant_mode)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_organism_sessions_flow_pct ON organism_sessions(flow_percentage DESC)`;
    console.log('✅ Migration: organism_sessions table ensured');

    // Migration: organism_profiles table (Section 09 — Evolution System)
    await sql`
      CREATE TABLE IF NOT EXISTS organism_profiles (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       VARCHAR(255) NOT NULL UNIQUE,
        computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        session_count INTEGER NOT NULL DEFAULT 0,
        bounce_bias   NUMERIC(5,4) NOT NULL DEFAULT 0,
        swing_bias    NUMERIC(5,4) NOT NULL DEFAULT 0,
        pocket_bias   NUMERIC(5,4) NOT NULL DEFAULT 0,
        presence_bias NUMERIC(5,4) NOT NULL DEFAULT 0,
        density_bias  NUMERIC(5,4) NOT NULL DEFAULT 0,
        pulse_bias    NUMERIC(6,2) NOT NULL DEFAULT 0,
        confidence    NUMERIC(4,3) NOT NULL DEFAULT 0,
        mode_bias     JSONB NOT NULL DEFAULT '{}'
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_organism_profiles_user_id ON organism_profiles(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_organism_profiles_computed_at ON organism_profiles(computed_at DESC)`;
    console.log('✅ Migration: organism_profiles table ensured');

    // Social Hub tables — were defined in schema.ts but never pushed to prod,
    // which 500'd every Social Hub action (posting/feed/chat/collab). Additive.
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id),
        display_name varchar, bio text, avatar_url varchar, website_url varchar,
        social_links jsonb, location varchar,
        favorite_genres text[], instruments text[], skill_level varchar,
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS project_shares (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar REFERENCES projects(id),
        shared_by_user_id varchar REFERENCES users(id),
        shared_with_user_id varchar REFERENCES users(id),
        permission varchar DEFAULT 'view', created_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS project_collaborations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar REFERENCES projects(id),
        user_id varchar REFERENCES users(id),
        role varchar DEFAULT 'collaborator',
        joined_at timestamp DEFAULT now(), last_active_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS project_comments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar REFERENCES projects(id),
        user_id varchar REFERENCES users(id),
        content text NOT NULL, parent_comment_id varchar,
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS project_likes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar REFERENCES projects(id),
        user_id varchar REFERENCES users(id),
        created_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS user_follows (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id varchar REFERENCES users(id),
        following_id varchar REFERENCES users(id),
        created_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS social_posts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id),
        platform varchar NOT NULL, content text NOT NULL, type varchar NOT NULL,
        title varchar, url varchar, media_url varchar,
        project_id varchar REFERENCES projects(id),
        likes integer DEFAULT 0, comments integer DEFAULT 0,
        shares integer DEFAULT 0, views integer DEFAULT 0,
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS social_connections (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id),
        platform varchar NOT NULL, platform_user_id varchar, platform_username varchar,
        access_token text, refresh_token text,
        connected boolean DEFAULT true, followers integer DEFAULT 0,
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id varchar REFERENCES users(id),
        recipient_id varchar REFERENCES users(id),
        conversation_id varchar NOT NULL, content text NOT NULL,
        message_type varchar DEFAULT 'text', attachment_url varchar,
        read_at timestamp, created_at timestamp DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS collab_invites (
        id serial PRIMARY KEY,
        from_user_id text NOT NULL, to_user_id text NOT NULL,
        project_id integer, type text NOT NULL, message text,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamp DEFAULT now(), expires_at timestamp
      )`;
    console.log('✅ Migration: Social Hub tables ensured');

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
