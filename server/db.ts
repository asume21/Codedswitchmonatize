import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Lazy-initialize database connection at first use (runtime) instead of module load (build time)
let _db: any = null;

export const db: any = new Proxy(
  {},
  {
    get(_target, prop) {
      // Initialize on first access
      if (!_db) {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error(
            "DATABASE_URL not set. DatabaseStorage cannot be used without a configured database.",
          );
        }
        const sql = neon(url);
        _db = drizzle(sql);
      }
      return _db[prop];
    },
  },
);
