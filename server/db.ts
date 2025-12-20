import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Singleton connection pool - reuse connections instead of creating new ones
let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqlInstance: ReturnType<typeof postgres> | null = null;

function getDb() {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set. DatabaseStorage cannot be used without a configured database.",
    );
  }
  
  // Create a single pooled connection with limits
  sqlInstance = postgres(url, {
    max: 10,              // Maximum 10 connections in pool
    idle_timeout: 20,     // Close idle connections after 20 seconds
    connect_timeout: 10,  // Connection timeout 10 seconds
  });
  
  dbInstance = drizzle(sqlInstance);
  return dbInstance;
}

// Export the singleton database instance
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      return (getDb() as any)[prop];
    },
  },
) as any;
