/**
 * Trial Credits Middleware
 * Grants one-time trial credits to new users
 */

import type { IStorage } from "../storage";
import { getCreditService, CreditTransactionType } from "../services/credits";

const TRIAL_CREDITS = 200; // One-time trial credits for new users

/**
 * Grant trial credits to a new user
 * Called once during user registration
 */
export async function grantTrialCredits(storage: IStorage, userId: string): Promise<void> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`User ${userId} not found for trial credits`);
      return;
    }

    // Check if user already received trial credits
    const transactions = await storage.getCreditTransactions(userId, 100, 0);
    const hasTrialCredits = transactions.some(
      (t: any) => t.type === CreditTransactionType.BONUS && t.reason.includes('Welcome trial')
    );

    if (hasTrialCredits) {
      console.log(`⏭️ User ${userId} already received trial credits`);
      return;
    }

    // Grant trial credits
    const creditService = getCreditService(storage);
    await creditService.addCredits(
      userId,
      TRIAL_CREDITS,
      CreditTransactionType.BONUS,
      'Welcome trial credits - Try Suno AI!',
      {
        trial: true,
        grantedAt: new Date().toISOString(),
      }
    );

    console.log(`🎁 Granted ${TRIAL_CREDITS} trial credits to new user ${userId}`);
  } catch (error) {
    console.error(`Error granting trial credits to user ${userId}:`, error);
  }
}

/**
 * Check if user has used their trial credits
 */
export async function hasUsedTrialCredits(storage: IStorage, userId: string): Promise<boolean> {
  const transactions = await storage.getCreditTransactions(userId, 100, 0);
  return transactions.some(
    (t: any) => t.type === CreditTransactionType.BONUS && t.reason.includes('Welcome trial')
  );
}
