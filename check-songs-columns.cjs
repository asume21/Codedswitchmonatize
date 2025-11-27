const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  console.log('Adding is_public column to songs table...');
  
  try {
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false`;
    console.log('✅ Column added (or already exists)');
    
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'songs'`;
    console.log('Current columns:', cols.map(r => r.column_name));
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  
  await sql.end();
}

run();
