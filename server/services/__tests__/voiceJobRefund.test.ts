import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../../storage';
import { getCreditService, __resetCreditServiceForTests } from '../credits';
import { refundFailedVoiceJob } from '../jobQueue';

/**
 * Product review T1/T2 (2026-10-07): cloud voice conversions deduct credits
 * up front, and a failed (or restart-orphaned) job kept them — in prod half of
 * all jobs had failed. A failed job's cost must come back exactly once.
 */
describe('refundFailedVoiceJob', () => {
  let storage: MemStorage;
  let userId: string;

  beforeEach(async () => {
    __resetCreditServiceForTests();
    storage = new MemStorage();
    const user = await storage.createUser({ email: 'v@test.dev', username: 'v', password: 'x' } as any);
    userId = user.id;
    await getCreditService(storage).deductCredits(userId, 8, 'Voice conversion (cloud)');
  });

  const balance = async () => (await storage.getUser(userId))!.credits;

  it('returns the credits a failed cloud job cost', async () => {
    expect(await balance()).toBe(2);
    await refundFailedVoiceJob(storage, { id: 'job-1', userId, executionMode: 'cloud', creditsCost: 8 } as any);
    expect(await balance()).toBe(10);
  });

  it('refunds a job only once', async () => {
    const job = { id: 'job-1', userId, executionMode: 'cloud', creditsCost: 8 } as any;
    await refundFailedVoiceJob(storage, job);
    await refundFailedVoiceJob(storage, job);
    expect(await balance()).toBe(10);
  });

  it('does nothing for BYO-keys jobs, which cost no credits', async () => {
    await refundFailedVoiceJob(storage, { id: 'job-2', userId, executionMode: 'byo_keys', creditsCost: 0 } as any);
    expect(await balance()).toBe(2);
  });
});
