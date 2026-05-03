import { beforeEach, describe, expect, it } from 'vitest';
import { MemStorage } from '../storage';

// Local alias to avoid bringing in the full Drizzle types just for casting.
type User = Awaited<ReturnType<MemStorage['createUser']>>;

// Contract tests for credit operations on IStorage. MemStorage is single-
// threaded JS so it cannot reproduce a real DB race, but it can lock in the
// invariants every IStorage implementation MUST honor:
//
//   1. atomicDeductCredits combines balance check + decrement in one step.
//      The bug fixed in commit e4cf35b was that pre-check + later deduction
//      was non-atomic, allowing two concurrent requests to both pass the
//      check and both deduct.
//   2. Insufficient credits throws BEFORE the balance is mutated.
//   3. grantCreditsAtomic writes a ledger row whose balanceBefore/After
//      bracket the user's balance change exactly.
//   4. The deduct/grant pair is consistent: N grants of +x followed by N
//      deducts of -x leaves the balance unchanged.

async function seedUser(storage: MemStorage, credits: number): Promise<User> {
  const user = await storage.createUser({
    username: `u${Math.random().toString(36).slice(2, 8)}`,
    email: `${Math.random().toString(36).slice(2, 8)}@test.local`,
    password: 'x',
  } as any);
  return storage.updateUser(user.id, { credits } as Partial<User>);
}

describe('atomicDeductCredits', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('deducts when sufficient balance', async () => {
    const user = await seedUser(storage, 100);
    const updated = await storage.atomicDeductCredits(user.id, 30);
    expect(updated.credits).toBe(70);
    expect(updated.totalCreditsSpent ?? 0).toBe(30);
  });

  it('throws Insufficient when balance < amount, without mutating', async () => {
    const user = await seedUser(storage, 5);
    await expect(storage.atomicDeductCredits(user.id, 10)).rejects.toThrow(
      /Insufficient credits/,
    );
    const after = await storage.getUser(user.id);
    expect(after?.credits).toBe(5);
  });

  it('throws when user does not exist', async () => {
    await expect(storage.atomicDeductCredits('nope', 1)).rejects.toThrow(
      /User not found/,
    );
  });

  it('exact-balance deduction succeeds and lands at zero', async () => {
    const user = await seedUser(storage, 7);
    const updated = await storage.atomicDeductCredits(user.id, 7);
    expect(updated.credits).toBe(0);
  });

  it('serial deductions accumulate totalCreditsSpent correctly', async () => {
    const user = await seedUser(storage, 100);
    await storage.atomicDeductCredits(user.id, 10);
    await storage.atomicDeductCredits(user.id, 15);
    await storage.atomicDeductCredits(user.id, 25);
    const final = await storage.getUser(user.id);
    expect(final?.credits).toBe(50);
    expect(final?.totalCreditsSpent ?? 0).toBe(50);
  });

  it('the e4cf35b race pattern: 5 parallel deducts of 20 vs balance of 60 → exactly 3 succeed', async () => {
    // This exercises the contract: even when callers fan out in parallel,
    // total successful debits cannot exceed starting balance. MemStorage's
    // synchronous Map ops happen to satisfy this, but the test pins the
    // invariant for any IStorage replacement (DatabaseStorage's SQL txn).
    const user = await seedUser(storage, 60);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => storage.atomicDeductCredits(user.id, 20)),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(2);
    const final = await storage.getUser(user.id);
    expect(final?.credits).toBe(0);
  });
});

describe('grantCreditsAtomic', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('credits user and writes a ledger row whose before/after bracket the change', async () => {
    const user = await seedUser(storage, 10);
    const result = await storage.grantCreditsAtomic(user.id, 50, {
      userId: user.id,
      amount: 50,
      type: 'purchase',
      reason: 'unit test grant',
    } as any);

    expect(result.balanceBefore).toBe(10);
    expect(result.balanceAfter).toBe(60);
    expect(result.user.credits).toBe(60);
    expect(result.transaction.balanceBefore).toBe(10);
    expect(result.transaction.balanceAfter).toBe(60);
    expect(result.transaction.amount).toBe(50);
  });

  it('grant + deduct round-trip leaves balance unchanged', async () => {
    const user = await seedUser(storage, 25);
    await storage.grantCreditsAtomic(user.id, 10, {
      userId: user.id, amount: 10, type: 'purchase', reason: 't',
    } as any);
    await storage.atomicDeductCredits(user.id, 10);
    const final = await storage.getUser(user.id);
    expect(final?.credits).toBe(25);
  });
});
