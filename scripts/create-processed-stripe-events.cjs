// One-shot creator for the processed_stripe_events idempotency table.
// Run via: railway run node scripts/create-processed-stripe-events.cjs
// Idempotent: safe to run twice (uses IF NOT EXISTS).

const { Client } = require('pg');

async function main() {
  // Prefer the public proxy URL when running from a developer laptop
  // (DATABASE_URL on Railway is the internal *.railway.internal hostname
  // which only resolves inside the Railway network).
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No DATABASE_PUBLIC_URL or DATABASE_URL set. Try: railway run --service Postgres node scripts/create-processed-stripe-events.cjs');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const beforeRow = await client.query(
      "SELECT to_regclass('public.processed_stripe_events') AS exists"
    );
    const existedBefore = beforeRow.rows[0].exists !== null;

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_stripe_events (
        event_id varchar PRIMARY KEY,
        event_type text NOT NULL,
        user_id varchar,
        payment_intent_id text,
        processed_at timestamp DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_payment_intent
        ON processed_stripe_events(payment_intent_id);
    `);

    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'processed_stripe_events'
      ORDER BY ordinal_position
    `);
    const idx = await client.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'processed_stripe_events'
    `);

    console.log(existedBefore ? '[ok] table already existed — verifying' : '[ok] table created');
    console.log('Columns:');
    for (const r of cols.rows) {
      console.log(`  - ${r.column_name} ${r.data_type} ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }
    console.log('Indexes:');
    for (const r of idx.rows) console.log(`  - ${r.indexname}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
