#!/usr/bin/env tsx
/**
 * WebEar real-usage stats — the funnel that actually matters, not npm downloads.
 * Run: npm run webear-stats
 *
 * Needs DATABASE_URL (or DATABASE_PUBLIC_URL) in env — point it at the prod DB
 * to see live numbers. npm downloads are bot-inflated and meaningless for a
 * key-gated product; THIS is the real signal: who got a key, who actually used
 * it, and who spent credits.
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';

function bar(label: string, value: number | string) {
  console.log(`  ${label.padEnd(34)} ${String(value)}`);
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_PUBLIC_URL) {
    console.error('❌ Set DATABASE_URL (or DATABASE_PUBLIC_URL) to your prod DB and re-run.');
    process.exit(1);
  }

  console.log('\n══════════════════ WebEar Real Usage ══════════════════\n');

  // ── Key funnel ───────────────────────────────────────────────────────
  const [keys] = (await db.execute(sql`
    SELECT
      COUNT(*)::int                                                       AS total_keys,
      COUNT(DISTINCT user_id)::int                                        AS distinct_users,
      COUNT(*) FILTER (WHERE usage_count > 0)::int                        AS keys_used,
      COALESCE(SUM(usage_count), 0)::int                                  AS total_calls_tracked,
      COUNT(*) FILTER (WHERE last_used_at > now() - interval '30 days')::int AS keys_active_30d,
      COUNT(*) FILTER (WHERE last_used_at > now() - interval '7 days')::int  AS keys_active_7d
    FROM webear_api_keys
  `)) as any;

  console.log('KEY FUNNEL');
  bar('Keys issued', keys.total_keys);
  bar('Distinct users with a key', keys.distinct_users);
  bar('Keys that ever made a call', keys.keys_used);
  bar('  → activation rate', keys.total_keys > 0
    ? `${Math.round((keys.keys_used / keys.total_keys) * 100)}%`
    : 'n/a');
  bar('Keys active last 30 days', keys.keys_active_30d);
  bar('Keys active last 7 days', keys.keys_active_7d);
  bar('Total calls (usage_count sum)', keys.total_calls_tracked);

  // ── Spend (credit transactions tagged webear) ────────────────────────
  const [spend] = (await db.execute(sql`
    SELECT
      COUNT(*)::int                       AS calls_billed,
      COUNT(DISTINCT user_id)::int        AS paying_users,
      COALESCE(SUM(-amount), 0)::int      AS credits_spent
    FROM credit_transactions
    WHERE reason ILIKE 'webear%' AND amount < 0
  `)) as any;

  console.log('\nSPEND (credits)');
  bar('Users who spent on WebEar', spend.paying_users);
  bar('Billed calls', spend.calls_billed);
  bar('Total credits spent', spend.credits_spent);

  // ── Breakdown by tool ────────────────────────────────────────────────
  const byTool = (await db.execute(sql`
    SELECT reason,
      COUNT(*)::int                  AS calls,
      COALESCE(SUM(-amount), 0)::int  AS credits
    FROM credit_transactions
    WHERE reason ILIKE 'webear%' AND amount < 0
    GROUP BY reason
    ORDER BY calls DESC
  `)) as any as Array<{ reason: string; calls: number; credits: number }>;

  console.log('\nBY TOOL');
  if (byTool.length === 0) {
    console.log('  (no billed WebEar calls yet)');
  } else {
    for (const r of byTool) bar(r.reason, `${r.calls} calls · ${r.credits} credits`);
  }

  console.log('\n════════════════════════════════════════════════════════\n');
  console.log('Reminder: npm downloads ≠ users. The activation rate and');
  console.log('paying-users count above are the numbers that decide whether');
  console.log('WebEar is worth marketing or just needs reach.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Stats query failed:', err);
  process.exit(1);
});
