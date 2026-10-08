/**
 * Schema drift check — run at boot, after migrations.
 *
 * shared/schema.ts (Drizzle) and the hand-written DDL in runMigrations.ts are
 * two sources of truth, and production quietly fell behind three times: the
 * Social Hub outage (July), blog_posts never existing, jam_* keeping an old
 * shape (product review D1-D3). Nothing noticed until a page 500'd. This
 * compares what the code expects with what the database has and logs every
 * missing table/column loudly at startup. Read-only.
 */
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../../shared/schema';

export type ExpectedSchema = Record<string, string[]>;
export type ActualSchema = Record<string, Set<string>>;

export function expectedSchemaFromDrizzle(): ExpectedSchema {
  const expected: ExpectedSchema = {};
  for (const value of Object.values(schema)) {
    if (value instanceof PgTable) {
      const cfg = getTableConfig(value);
      expected[cfg.name] = cfg.columns.map((c) => c.name);
    }
  }
  return expected;
}

export function findSchemaDrift(expected: ExpectedSchema, actual: ActualSchema) {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const [table, columns] of Object.entries(expected)) {
    const have = actual[table];
    if (!have) {
      missingTables.push(table);
      continue;
    }
    for (const col of columns) if (!have.has(col)) missingColumns.push(`${table}.${col}`);
  }
  return { missingTables, missingColumns };
}

/** Query the live database and log any drift. Never throws. */
export async function checkSchemaDrift(
  query: (text: string) => Promise<Array<{ table_name: string; column_name: string }>>,
): Promise<ReturnType<typeof findSchemaDrift> | null> {
  try {
    const rows = await query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
    );
    const actual: ActualSchema = {};
    for (const r of rows) (actual[r.table_name] ??= new Set()).add(r.column_name);
    const drift = findSchemaDrift(expectedSchemaFromDrizzle(), actual);
    if (drift.missingTables.length || drift.missingColumns.length) {
      console.error(
        `❌ SCHEMA DRIFT — the database is missing what shared/schema.ts expects.\n` +
          `   Missing tables: ${drift.missingTables.join(', ') || 'none'}\n` +
          `   Missing columns: ${drift.missingColumns.join(', ') || 'none'}\n` +
          `   Add the DDL to server/migrations/runMigrations.ts.`,
      );
    } else {
      console.log('✅ Schema check: database matches shared/schema.ts');
    }
    return drift;
  } catch (err) {
    console.error('Schema drift check could not run:', err);
    return null;
  }
}
