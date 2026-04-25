import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import type { IStorage } from '../../storage';
import { handleStripeWebhook } from '../../services/stripe';

const WEBHOOK_SECRET = 'whsec_test_secret';

function signedPayload(event: object) {
  const body = JSON.stringify(event);
  const payload = Buffer.from(body, 'utf8');
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
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

function makeStorageMock(): IStorage {
  return {
    getCreditTransactions: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue({
      id: 'user_test_123',
      email: 'test@example.com',
      username: 'testuser',
      credits: 0,
    }),
    updateUser: vi.fn().mockResolvedValue({
      id: 'user_test_123',
      credits: 100,
    }),
    logCreditTransaction: vi.fn().mockResolvedValue(undefined),
  } as unknown as IStorage;
}

describe('handleStripeWebhook — checkout.session.completed (credit purchase)', () => {
  let storage: IStorage;

  beforeEach(() => {
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
    expect(storage.getCreditTransactions).toHaveBeenCalledWith('user_test_123', 200, 0);
    expect(storage.updateUser).toHaveBeenCalledWith('user_test_123', { credits: 100 });
    expect(storage.logCreditTransaction).toHaveBeenCalledTimes(1);
    expect(storage.logCreditTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_test_123',
        amount: 100,
        type: 'purchase',
      }),
    );
  });

  it('skips a duplicate delivery (idempotency by stripeEventId)', async () => {
    storage.getCreditTransactions = vi.fn().mockResolvedValue([
      { metadata: { stripeEventId: 'evt_test_credit_purchase' } },
    ]);

    const event = makeCheckoutSessionCompleted();
    const { payload, signature } = signedPayload(event);

    const result = await handleStripeWebhook(storage, payload, signature);

    expect(result.received).toBe(true);
    expect(storage.updateUser).not.toHaveBeenCalled();
    expect(storage.logCreditTransaction).not.toHaveBeenCalled();
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
    expect(storage.updateUser).not.toHaveBeenCalled();
    expect(storage.logCreditTransaction).not.toHaveBeenCalled();
  });
});
