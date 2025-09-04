import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Initialize Drizzle only when DATABASE_URL is provided.
// In development we often use MemStorage, so this file must not throw on import.
const url = process.env.DATABASE_URL;

export const db: any = (() => {
  if (url) {
    const sql = neon(url);
    return drizzle(sql);
  }
  // Fallback proxy that throws only when actually used
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          "DATABASE_URL not set. DatabaseStorage cannot be used without a configured database.",
        );
      },
    },
  );
})();
