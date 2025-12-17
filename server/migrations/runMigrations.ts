import postgres from "postgres";

/**
 * Run database migrations on startup
 * This ensures the database schema is up to date
 */
export async function runMigrations() {
  // Prefer public URL for external access (Replit), fallback to internal (Railway)
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
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

    // Create user subscriptions table for Stripe billing
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
    console.log('? Migration: user_subscriptions table ensured');

    console.log('? All migrations completed successfully');
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
