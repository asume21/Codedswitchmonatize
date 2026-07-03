import 'dotenv/config';
import { db } from '../server/db';
import { creditTransactions, users } from '../shared/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  console.log('\n🔍 Fetching 20 most recent credit transactions...\n');

  const list = await db
    .select({
      id: creditTransactions.id,
      username: users.username,
      email: users.email,
      amount: creditTransactions.amount,
      type: creditTransactions.type,
      reason: creditTransactions.reason,
      balanceBefore: creditTransactions.balanceBefore,
      balanceAfter: creditTransactions.balanceAfter,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .leftJoin(users, eq(creditTransactions.userId, users.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(20);

  if (list.length === 0) {
    console.log('No transactions recorded in database.');
    process.exit(0);
  }

  console.log(''.padEnd(100, '─'));
  console.log(
    `${'Date/Time'.padEnd(20)} | ${'User'.padEnd(18)} | ${'Change'.padStart(8)} | ${'Balance'.padStart(8)} | ${'Type'.padEnd(10)} | ${'Reason'}`
  );
  console.log(''.padEnd(100, '─'));

  for (const t of list) {
    const dateStr = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 19).replace('T', ' ') : 'unknown';
    const userStr = t.username || 'unknown';
    const amountStr = t.amount > 0 ? `+${t.amount}` : `${t.amount}`;
    const balanceStr = `${t.balanceAfter}`;
    const typeStr = (t.type || '').padEnd(10);
    
    console.log(
      `${dateStr.padEnd(20)} | ${userStr.padEnd(18)} | ${amountStr.padStart(8)} | ${balanceStr.padStart(8)} | ${typeStr} | ${t.reason}`
    );
  }
  console.log(''.padEnd(100, '─') + '\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to query transactions:', err);
  process.exit(1);
});
