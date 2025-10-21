import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Create a fresh database connection getter that reads DATABASE_URL at runtime
function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set. DatabaseStorage cannot be used without a configured database.",
    );
  }
  // Log the URL being used (without the password)
  const urlObj = new URL(url);
  const safeUrl = `${urlObj.protocol}//${urlObj.username}:***@${urlObj.hostname}:${urlObj.port}${urlObj.pathname}`;
  console.log('🔗 Creating Neon client with URL:', safeUrl);
  
  // Always create a fresh Neon client with current DATABASE_URL
  const sql = neon(url);
  return drizzle(sql);
}

// Export a getter that always uses the current DATABASE_URL
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      // Get fresh db instance on each access to ensure latest DATABASE_URL
      return (getDb() as any)[prop];
    },
  },
) as any;
