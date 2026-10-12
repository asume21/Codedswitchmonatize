import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

// Comp a tester: give an EXISTING account (they sign up first) free Pro access
// plus a credit grant, without Stripe. Undo with --revoke.
//
// Pro access needs both fields: subscription_tier='pro' (tierEnforcement,
// client isPro) AND subscription_status='active' (requireSubscription in
// server/middleware/auth.ts). Credits are a separate balance spent by AI calls.

const USAGE = `Usage:
  npx tsx scripts/grant-tester.ts <email> [credits]   Give Pro + credits (default 1000)
  npx tsx scripts/grant-tester.ts <email> --revoke    Take comped Pro back (credits are kept)`;

const MAX_CREDITS = 10000;
const DEFAULT_CREDITS = 1000; // one month of Pro

const email = (process.argv[2] || "").trim().toLowerCase();
const arg = process.argv[3];
const revoke = arg === "--revoke";

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  console.log(USAGE);
  process.exit(1);
}

const credits = revoke ? 0 : arg === undefined ? DEFAULT_CREDITS : Number(arg);
if (!revoke && (!Number.isInteger(credits) || credits < 0 || credits > MAX_CREDITS)) {
  console.log(`Credits must be a whole number from 0 to ${MAX_CREDITS}.`);
  process.exit(1);
}

const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.log("No DATABASE_URL set.");
  process.exit(1);
}

const sql = postgres(url);

async function run() {
  try {
    await sql.begin(async (tx) => {
      // Lock the row so a concurrent credit spend can't race the ledger numbers.
      const users = await tx`
        SELECT id, email, username, credits, subscription_tier, subscription_status, stripe_subscription_id
        FROM users WHERE lower(email) = ${email} FOR UPDATE`;
      if (users.length === 0) {
        console.log(`No user found with email: ${email}`);
        console.log("Have them sign up on the site first, then run this again.");
        return;
      }
      const user = users[0];
      console.log(`Found user: ${user.username} (${user.email})`);
      console.log(`  before: tier=${user.subscription_tier} status=${user.subscription_status} credits=${user.credits}`);

      if (user.stripe_subscription_id) {
        console.log("  ⚠️ This account has a real Stripe subscription — leaving it alone.");
        return;
      }

      if (revoke) {
        await tx`
          UPDATE users SET subscription_tier = 'free', subscription_status = 'inactive'
          WHERE id = ${user.id}`;
        console.log("  after:  tier=free status=inactive (credits unchanged)");
        return;
      }

      const before = user.credits ?? 0;
      const after = before + credits;
      await tx`
        UPDATE users
        SET subscription_tier = 'pro', subscription_status = 'active', credits = ${after}
        WHERE id = ${user.id}`;
      if (credits > 0) {
        await tx`
          INSERT INTO credit_transactions (user_id, amount, type, reason, balance_before, balance_after, metadata)
          VALUES (${user.id}, ${credits}, 'admin_adjustment', 'Tester comp', ${before}, ${after},
                  ${sql.json({ comp: "tester", script: "grant-tester" })})`;
      }
      console.log(`  after:  tier=pro status=active credits=${after}`);

      // A leftover non-active subscription row (e.g. an abandoned checkout)
      // makes tierEnforcement treat the stored tier as lapsed.
      const subs = await tx`SELECT status FROM user_subscriptions WHERE user_id = ${user.id} LIMIT 1`;
      const subStatus = subs[0]?.status;
      if (subs.length > 0 && subStatus !== "active" && subStatus !== "trialing") {
        console.log(`  ⚠️ user_subscriptions row has status '${subStatus}' — some Pro features may still be locked.`);
      }
    });
    console.log("Done. They may need to log out and back in to see it.");
  } catch (e: any) {
    console.log("Error:", e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

run();
