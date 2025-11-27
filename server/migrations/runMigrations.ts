import postgres from "postgres";

/**
 * Run database migrations on startup
 * This ensures the database schema is up to date
 */
export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('⚠️ No DATABASE_URL - skipping migrations');
    return;
  }

  console.log('🔄 Running database migrations...');
  
  const sql = postgres(url);
  
  try {
    // Migration: Add transcription columns to songs table
    await sql`
      ALTER TABLE songs 
      ADD COLUMN IF NOT EXISTS transcription TEXT,
      ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMP
    `;
    console.log('✅ Migration: transcription columns added to songs table');

    // Create index for transcription status
    await sql`
      CREATE INDEX IF NOT EXISTS idx_songs_transcription_status ON songs(transcription_status)
    `;
    console.log('✅ Migration: transcription_status index created');

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    // If columns already exist, that's fine
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('✅ Migrations: columns already exist, skipping');
    } else {
      console.error('❌ Migration error:', error);
    }
  } finally {
    await sql.end();
  }
}
