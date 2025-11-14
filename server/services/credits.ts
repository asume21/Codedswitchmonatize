/**
 * Credit System Service
 * Handles credit balance, deductions, purchases, and transaction history
 */

import type { IStorage } from "../storage";

// Credit costs for different operations
// Based on actual API costs with 2.5x profit margin
// See PRICING_CALCULATOR.md for detailed breakdown
export const CREDIT_COSTS = {
  // Tier 1: Suno (Premium AI) - Most Expensive
  SONG_GENERATION: 25,          // API: $0.40 → User: $1.00
  SONG_EXTENSION: 16,           // API: $0.25 → User: $0.64
  CUSTOM_VOCALS: 22,            // API: $0.35 → User: $0.88
  STEM_SEPARATION: 19,          // API: $0.30 → User: $0.76
  
  // Tier 2: MusicGen (Advanced AI)
  BEAT_GENERATION: 5,           // API: $0.075 → User: $0.20
  MELODY_GENERATION: 5,         // API: $0.075 → User: $0.20
  INSTRUMENTAL_GENERATION: 8,   // API: $0.125 → User: $0.32
  GENRE_BLENDING: 10,           // API: $0.15 → User: $0.40
  DRUM_GENERATION: 3,           // API: $0.04 → User: $0.12
  
  // Tier 3: Grok/OpenAI (Text AI)
  LYRICS_GENERATION: 4,         // API: $0.055 → User: $0.16
  LYRICS_ANALYSIS: 2,           // API: $0.035 → User: $0.08
  RHYME_SUGGESTIONS: 1,         // API: $0.015 → User: $0.04
  SONG_ANALYSIS: 2,             // API: $0.035 → User: $0.08
  CODE_TRANSLATION: 2,          // API: $0.035 → User: $0.08
  
  // Tier 4: Audio Processing
  AI_MIXING: 7,                 // API: $0.10 → User: $0.28
  AUDIO_MASTERING: 8,           // API: $0.125 → User: $0.32
  TRANSCRIPTION: 5,             // API: $0.08 → User: $0.20
  AI_ENHANCEMENT: 6,            // API: $0.09 → User: $0.24
} as const;

// Membership tiers (recurring subscriptions)
export const MEMBERSHIP_TIERS = {
  FREE: {
    tier: 'free',
    name: 'Free',
    price: 0,
    priceId: '', // No Stripe product needed
    monthlyCredits: 10,
    rolloverMax: 0,
    features: [
      'Try basic features',
      '10 credits/month',
      'Community support',
    ],
  },
  CREATOR: {
    tier: 'creator',
    name: 'Creator',
    price: 999, // $9.99/month
    priceId: process.env.STRIPE_PRICE_ID_CREATOR || '',
    monthlyCredits: 200,
    rolloverMax: 400,
    features: [
      '200 credits/month',
      'Credits rollover (max 400)',
      'Priority support',
      'No ads',
      'Early access to features',
      'Premium templates',
    ],
    badge: 'Most Popular',
  },
  PRO: {
    tier: 'pro',
    name: 'Pro',
    price: 2999, // $29.99/month
    priceId: process.env.STRIPE_PRICE_ID_PRO_MEMBERSHIP || '',
    monthlyCredits: 750,
    rolloverMax: 1500,
    features: [
      '750 credits/month',
      'Credits rollover (max 1500)',
      'Priority queue',
      'Advanced analytics',
      'Commercial license',
      'API access',
      'Advanced AI models',
    ],
    badge: 'Best Value',
  },
  STUDIO: {
    tier: 'studio',
    name: 'Studio',
    price: 7999, // $79.99/month
    priceId: process.env.STRIPE_PRICE_ID_STUDIO || '',
    monthlyCredits: 2500,
    rolloverMax: 5000,
    features: [
      '2500 credits/month',
      'Credits rollover (max 5000)',
      'Team collaboration (5 seats)',
      'White-label branding',
      'Dedicated support',
      'Custom integrations',
      'Phone support',
      'Training sessions',
    ],
    badge: 'Enterprise',
  },
} as const;

// Credit packages for one-time purchase
export const CREDIT_PACKAGES = {
  STARTER: {
    credits: 100,
    price: 499, // $4.99 in cents
    priceId: process.env.STRIPE_PRICE_ID_100_CREDITS || '',
    name: 'Starter Pack',
    description: '100 credits',
  },
  POPULAR: {
    credits: 500,
    price: 1999, // $19.99 (20% discount)
    priceId: process.env.STRIPE_PRICE_ID_500_CREDITS || '',
    name: 'Popular Pack',
    description: '500 credits - Save 20%',
    badge: 'Popular',
  },
  PRO: {
    credits: 1000,
    price: 3499, // $34.99 (30% discount)
    priceId: process.env.STRIPE_PRICE_ID_1000_CREDITS || '',
    name: 'Pro Pack',
    description: '1000 credits - Save 30%',
    badge: 'Best Value',
  },
  ENTERPRISE: {
    credits: 5000,
    price: 14999, // $149.99 (40% discount)
    priceId: process.env.STRIPE_PRICE_ID_5000_CREDITS || '',
    name: 'Enterprise Pack',
    description: '5000 credits - Save 40%',
  },
} as const;

// Transaction types
export enum CreditTransactionType {
  PURCHASE = 'purchase',
  DEDUCTION = 'deduction',
  REFUND = 'refund',
  SUBSCRIPTION_GRANT = 'subscription_grant',
  BONUS = 'bonus',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number; // positive for credit, negative for debit
  type: CreditTransactionType;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class CreditService {
  constructor(private storage: IStorage) {}

  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.credits || 0;
  }

  /**
   * Check if user has enough credits
   */
  async hasCredits(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  /**
   * Deduct credits from user's account
   */
  async deductCredits(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<CreditTransaction> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const balanceBefore = user.credits || 0;
    
    if (balanceBefore < amount) {
      throw new Error(`Insufficient credits. Need ${amount}, have ${balanceBefore}`);
    }

    const balanceAfter = balanceBefore - amount;

    // Update user balance
    await this.storage.updateUser(userId, {
      credits: balanceAfter,
      totalCreditsSpent: (user.totalCreditsSpent || 0) + amount,
    });

    // Log transaction
    const transaction: CreditTransaction = {
      id: crypto.randomUUID(),
      userId,
      amount: -amount,
      type: CreditTransactionType.DEDUCTION,
      reason,
      balanceBefore,
      balanceAfter,
      metadata,
      createdAt: new Date(),
    };

    await this.storage.logCreditTransaction(transaction);

    console.log(`💳 Credits deducted: User ${userId}, -${amount} credits, Reason: ${reason}`);

    return transaction;
  }

  /**
   * Add credits to user's account
   */
  async addCredits(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<CreditTransaction> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const balanceBefore = user.credits || 0;
    const balanceAfter = balanceBefore + amount;

    // Update user balance
    await this.storage.updateUser(userId, {
      credits: balanceAfter,
    });

    // Log transaction
    const transaction: CreditTransaction = {
      id: crypto.randomUUID(),
      userId,
      amount: amount,
      type,
      reason,
      balanceBefore,
      balanceAfter,
      metadata,
      createdAt: new Date(),
    };

    await this.storage.logCreditTransaction(transaction);

    console.log(`💳 Credits added: User ${userId}, +${amount} credits, Reason: ${reason}`);

    return transaction;
  }

  /**
   * Get user's credit transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CreditTransaction[]> {
    return this.storage.getCreditTransactions(userId, limit, offset);
  }

  /**
   * Grant monthly credits to pro subscribers
   */
  async grantMonthlyCredits(userId: string): Promise<void> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is pro tier
    if (user.subscriptionTier !== 'pro') {
      throw new Error('Only pro users get monthly credits');
    }

    // Check if we already granted this month
    const lastReset = user.lastUsageReset ? new Date(user.lastUsageReset) : new Date(0);
    const now = new Date();
    const monthsSinceReset = 
      (now.getFullYear() - lastReset.getFullYear()) * 12 + 
      (now.getMonth() - lastReset.getMonth());

    if (monthsSinceReset < 1) {
      console.log(`⏭️ Monthly credits already granted for user ${userId} this month`);
      return;
    }

    // Grant 1000 credits for pro users
    await this.addCredits(
      userId,
      1000,
      CreditTransactionType.SUBSCRIPTION_GRANT,
      'Monthly pro subscription credits',
      { month: now.toISOString().substring(0, 7) }
    );

    // Update last reset date
    await this.storage.updateUser(userId, {
      lastUsageReset: now,
      monthlyGenerations: 0, // Reset monthly counter
    });

    console.log(`🎁 Granted monthly credits to user ${userId}`);
  }

  /**
   * Purchase credits via Stripe
   */
  async purchaseCredits(
    userId: string,
    packageKey: keyof typeof CREDIT_PACKAGES,
    paymentIntentId: string
  ): Promise<CreditTransaction> {
    const creditPackage = CREDIT_PACKAGES[packageKey];
    
    return this.addCredits(
      userId,
      creditPackage.credits,
      CreditTransactionType.PURCHASE,
      `Purchased ${creditPackage.name}`,
      {
        package: packageKey,
        paymentIntentId,
        price: creditPackage.price / 100, // Convert cents to dollars
      }
    );
  }

  /**
   * Refund credits
   */
  async refundCredits(
    userId: string,
    transactionId: string,
    reason: string
  ): Promise<CreditTransaction> {
    const originalTransaction = await this.storage.getCreditTransaction(transactionId);
    
    if (!originalTransaction) {
      throw new Error('Transaction not found');
    }

    if (originalTransaction.userId !== userId) {
      throw new Error('Transaction does not belong to this user');
    }

    if (originalTransaction.type !== CreditTransactionType.DEDUCTION) {
      throw new Error('Can only refund deductions');
    }

    // Refund the absolute value (add back what was deducted)
    const refundAmount = Math.abs(originalTransaction.amount);

    return this.addCredits(
      userId,
      refundAmount,
      CreditTransactionType.REFUND,
      reason,
      {
        originalTransactionId: transactionId,
        originalReason: originalTransaction.reason,
      }
    );
  }

  /**
   * Get credit usage stats for user
   */
  async getUsageStats(userId: string): Promise<{
    currentBalance: number;
    totalSpent: number;
    monthlyUsage: number;
    lastTransaction?: CreditTransaction;
  }> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const transactions = await this.getTransactionHistory(userId, 1);

    return {
      currentBalance: user.credits || 0,
      totalSpent: user.totalCreditsSpent || 0,
      monthlyUsage: user.monthlyGenerations || 0,
      lastTransaction: transactions[0],
    };
  }
}

/**
 * Singleton instance
 */
let creditServiceInstance: CreditService | null = null;

export function getCreditService(storage: IStorage): CreditService {
  if (!creditServiceInstance) {
    creditServiceInstance = new CreditService(storage);
  }
  return creditServiceInstance;
}
