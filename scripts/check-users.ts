import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.log("NO DATABASE_URL SET - server is using MemStorage (in-memory)");
  console.log("All user data is lost on restart when using MemStorage!");
  process.exit(0);
}

console.log("Database URL found, querying users...");
const sql = postgres(url);

async function run() {
  try {
    // Check if users table exists
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    if (tables.length === 0) {
      console.log("ERROR: users table does NOT exist!");
      return;
    }
    console.log("users table exists");

    // Count and list users
    const users = await sql`SELECT id, email, username, created_at FROM users ORDER BY created_at DESC LIMIT 20`;
    console.log(`\nTotal users found: ${users.length}`);
    for (const u of users) {
      console.log(`  - ${u.email} (username: ${u.username}, id: ${u.id}, created: ${u.created_at})`);
    }

    if (users.length === 0) {
      console.log("\nNo users in database! Users need to register via /signup first.");
    }

    // Check session table
    const sessions = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'session'
    `;
    console.log(`\nsession table exists: ${sessions.length > 0}`);

  } catch (e: any) {
    console.log("ERROR:", e.message);
  } finally {
    await sql.end();
  }
}

run();
