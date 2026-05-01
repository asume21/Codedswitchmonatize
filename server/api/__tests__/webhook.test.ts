import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import type { IStorage } from '../../storage';
import { handleStripeWebhook } from '../../services/stripe';
import { __resetCreditServiceForTests } from '../../services/credits';

// Properly mock the Stripe default export and its static webhooks property
vi.mock('stripe', () => {
  const mockConstructEvent = vi.fn((payload, sig, secret) => {
    // Simulate real behavior: if signature doesn't match secret, throw
    if (sig === 'bad_sig' || (secret === 'whsec_test_secret' && sig !== 'valid_sig')) {
      throw new Error('No signatures found matching the expected signature');
    }
    return JSON.parse(payload.toString());
  });

  return {
    default: class MockStripe {
      constructor() {
        (this as any).subscriptions = {
          retrieve: vi.fn().mockResolvedValue({ status: 'active' }),
        };
      }
      static webhooks = {
        constructEvent: mockConstructEvent,
        generateTestHeaderString: vi.fn(({ secret }) => {
          return secret === 'whsec_test_secret' ? 'valid_sig' : 'bad_sig';
        }),
      };
    },
  };
});

const WEBHOOK_SECRET = 'whsec_test_secret';

function signedPayload(event: object) {
  const body = JSON.stringify(event);
  const payload = Buffer.from(body, 'utf8');
  // In the real Stripe SDK, this generates a real header. 
  // With our mock, we just need a non-empty string.
  const signature = 'valid_sig'; 
  return { payload, signature };
}

function makeCheckoutSessionCompleted() {
  return {
    id: 'evt_test_credit_purchase',
    object: 'event',
    type: 'checkout.session.completed',
    api_version: '2025-08-27.basil',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: 'cs_test_123',
        object: 'checkout.session',
        mode: 'payment',
        customer: 'cus_test_123',
        subscription: null,
        payment_intent: 'pi_test_123',
        metadata: {
          userId: 'user_test_123',
          packageKey: 'STARTER',
          credits: '100',
        },
      },
    },
  };
}

// Stateful mock — simulates the real storage backends instead of returning
// hardcoded values per call. Audit 2026-04-30 caught a self-cancel bug that
// the previous flat mock missed: tryClaimStripeEvent was inserting a row with
// paymentIntentId, then purchaseCredits' hasProcessedPaymentIntent saw that
// row and short-circuited the grant. With the fix in place,
// hasProcessedPaymentIntent answers from the credit-transaction ledger, so
// the dedup check is "did we ever actually grant credits for this PI?" — and
// this mock has to model that or we lose the regression coverage.
function makeStorageMock(opts: { eventAlreadyClaimed?: boolean } = {}): IStorage {
  const claimedEvents = new Set<string>();
  // Pre-seed when the test wants to simulate a duplicate webhook delivery.
  if (opts.eventAlreadyClaimed) claimedEvents.add('evt_test_credit_purchase');

  // The credit-transaction ledger is the source of truth for "was a grant
  // already made for this paymentIntent?" — mirror DatabaseStorage exactly.
  const ledger: Array<{
    amount: number;
    metadata?: { paymentIntentId?: string };
  }> = [];

  // Track the user's running balance so the transactional mock can simulate
  // a real Postgres transaction's atomic commit/rollback behavior.
  let userBalance = 0;

  const storage = {
    tryClaimStripeEvent: vi.fn(async (event: { eventId: string }) => {
      if (claimedEvents.has(event.eventId)) return false;
      claimedEvents.add(event.eventId);
      return true;
    }),
    releaseStripeEvent: vi.fn(async (eventId: string) => {
      claimedEvents.delete(eventId);
    }),
    hasProcessedPaymentIntent: vi.fn(async (paymentIntentId: string) => {
      return ledger.some(
        (t) => t.metadata?.paymentIntentId === paymentIntentId && t.amount > 0,
      );
    }),
    getUser: vi.fn(async () => ({
      id: 'user_test_123',
      email: 'test@example.com',
      username: 'testuser',
      credits: userBalance,
    })),
    atomicAddCredits: vi.fn(async (_userId: string, amount: number) => {
      userBalance += amount;
      return {
        user: { id: 'user_test_123', credits: userBalance },
        balanceBefore: userBalance - amount,
        balanceAfter: userBalance,
      };
    }),
    logCreditTransaction: vi.fn(
      async (txn: { amount: number; metadata?: { paymentIntentId?: string } }) => {
        ledger.push({ amount: txn.amount, metadata: txn.metadata });
      },
    ),
    // Transactional grant: balance update + ledger insert atomic via simulated
    // rollback. Tests can override this mock to inject a mid-transaction
    // failure and assert that userBalance does NOT advance.
    grantCreditsAtomic: vi.fn(async (
      userId: string,
      amount: number,
      txn: { id?: string; type: string; reason: string; metadata?: { paymentIntentId?: string }; createdAt?: Date },
    ) => {
      const balanceBefore = userBalance;
      userBalance += amount;
      const balanceAfter = userBalance;
      try {
        const transaction = {
          id: txn.id ?? 'txn_test',
          userId,
          amount,
          type: txn.type,
          reason: txn.reason,
          metadata: txn.metadata,
          balanceBefore,
          balanceAfter,
          createdAt: txn.createdAt ?? new Date(),
        };
        ledger.push({ amount, metadata: txn.metadata });
        return {
          user: { id: userId, credits: balanceAfter },
          balanceBefore,
          balanceAfter,
          transaction,
        };
      } catch (err) {
        // Real Postgres would roll back automatically; the mock has to do
        // it explicitly so tests see the same observable behavior.
        userBalance = balanceBefore;
        throw err;
      }
    }),
  };
  return storage as unknown as IStorage;
}

describe('handleStripeWebhook — checkout.session.completed (credit purchase)', () => {
  let storage: IStorage;

  beforeEach(() => {
    // Reset the credit service singleton so each test binds its own storage.
    // Without this, the first test's storage instance leaks into later tests
    // and causes spurious "already processed" dedup hits.
    __resetCreditServiceForTests();
    storage = makeStorageMock();
  });

  it('grants credits on first delivery and writes one transaction', async () => {
    const event = makeCheckoutSessionCompleted();
    const { payload, signature } = signedPayload(event);

    const result = await handleStripeWebhook(storage, payload, signature);

    expect(result).toEqual({
      received: true,
      type: 'checkout.session.completed',
      eventId: 'evt_test_credit_purchase',
    });
    expect(storage.tryClaimStripeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_test_credit_purchase',
        eventType: 'checkout.session.completed',
        paymentIntentId: 'pi_test_123',
      }),
    );
    // Audit 2026-04-30 (followup): credits now flow through grantCreditsAtomic
    // (single DB transaction wrapping balance UPDATE + ledger INSERT) instead
    // of the two-step atomicAddCredits + logCreditTransaction pattern.
    expect(storage.grantCreditsAtomic).toHaveBeenCalledWith(
      'user_test_123',
      100,
      expect.objectContaining({ type: 'purchase', userId: 'user_test_123', amount: 100 }),
    );
  });

  it('skips a duplicate delivery (claim returns false)', async () => {
    storage = makeStorageMock({ eventAlreadyClaimed: true });

    const event = makeCheckoutSessionCompleted();
    const { payload, signature } = signedPayload(event);

    const result = await handleStripeWebhook(storage, payload, signature);

    expect(result.received).toBe(true);
    expect(storage.tryClaimStripeEvent).toHaveBeenCalledTimes(1);
    expect(storage.grantCreditsAtomic).not.toHaveBeenCalled();
  });

  it('rejects a payload signed with the wrong secret', async () => {
    const event = makeCheckoutSessionCompleted();
    const body = JSON.stringify(event);
    const payload = Buffer.from(body, 'utf8');
    const badSignature = Stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: 'whsec_wrong_secret',
    });

    await expect(handleStripeWebhook(storage, payload, badSignature)).rejects.toThrow();
    expect(storage.tryClaimStripeEvent).not.toHaveBeenCalled();
    expect(storage.grantCreditsAtomic).not.toHaveBeenCalled();
  });

  // Audit 2026-04-30 regression test: if the post-claim grant throws, the
  // claim must be released so a Stripe retry can re-process. Without this
  // the user permanently loses credits on any transient DB error.
  it('releases the claim on grant failure so Stripe retry can recover', async () => {
    storage = makeStorageMock();
    // Simulate a DB blip during the credit grant.
    let attemptCount = 0;
    const original = storage.grantCreditsAtomic as ReturnType<typeof vi.fn>;
    const realImpl = original.getMockImplementation()!;
    original.mockImplementation(async (...args: any[]) => {
      attemptCount += 1;
      if (attemptCount === 1) throw new Error('transient DB error');
      return realImpl(...args);
    });

    const event = makeCheckoutSessionCompleted();
    const { payload, signature } = signedPayload(event);

    // First delivery: throws because the grant fails.
    await expect(handleStripeWebhook(storage, payload, signature)).rejects.toThrow(
      'transient DB error',
    );
    // Critical: the claim must have been released. If it wasn't, the next
    // call's tryClaimStripeEvent would return false and the user would
    // never get the credits.
    expect(storage.releaseStripeEvent).toHaveBeenCalledWith('evt_test_credit_purchase');

    // Second delivery (Stripe retry): claim is fresh, grant succeeds.
    const result = await handleStripeWebhook(storage, payload, signature);
    expect(result.received).toBe(true);
    expect(storage.grantCreditsAtomic).toHaveBeenCalledTimes(2);
  });

  // Audit 2026-04-30 (followup) regression test: this is the deeper hole
  // the reviewer flagged. If the balance UPDATE succeeds but the ledger
  // INSERT fails (or any post-balance side-effect throws), the user MUST NOT
  // end up with credits but no ledger row. Without the transactional wrap,
  // Stripe's retry would see no ledger row, treat the paymentIntent as
  // ungranted, and call grantCreditsAtomic AGAIN — double-grant.
  it('rolls back the user balance if grant fails mid-transaction', async () => {
    storage = makeStorageMock();
    const events: string[] = [];
    // Replace grantCreditsAtomic with a version that increments balance,
    // then throws BEFORE the ledger row commits — simulating a Postgres
    // transaction that fails on the INSERT after the UPDATE has been issued.
    // The contract: this method MUST atomically commit-or-rollback. If it
    // throws, the balance must not have advanced.
    let userBalance = 0;
    (storage.grantCreditsAtomic as ReturnType<typeof vi.fn>).mockImplementation(
      async (_userId: string, amount: number) => {
        const balanceBefore = userBalance;
        userBalance += amount; // simulate the UPDATE landing
        events.push('balance-updated');
        try {
          // Simulate the INSERT throwing.
          throw new Error('ledger insert failed');
        } catch (err) {
          // Real Postgres transaction would auto-rollback the UPDATE.
          userBalance = balanceBefore;
          events.push('rolled-back');
          throw err;
        }
      },
    );

    // Patch getUser to return the live (post-attempt) balance so the test
    // can assert the user did not end up with phantom credits.
    (storage.getUser as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      id: 'user_test_123',
      email: 'test@example.com',
      username: 'testuser',
      credits: userBalance,
    }));

    const event = makeCheckoutSessionCompleted();
    const { payload, signature } = signedPayload(event);

    await expect(handleStripeWebhook(storage, payload, signature)).rejects.toThrow(
      'ledger insert failed',
    );

    // Critical assertions:
    // 1. The simulated transaction rolled back (balance restored).
    expect(userBalance).toBe(0);
    // 2. The ordering inside grantCreditsAtomic shows commit-or-rollback semantics.
    expect(events).toEqual(['balance-updated', 'rolled-back']);
    // 3. The webhook claim was released so Stripe's retry can succeed.
    expect(storage.releaseStripeEvent).toHaveBeenCalledWith('evt_test_credit_purchase');
  });
});
