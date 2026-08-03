import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * Tier-based Access Control Middleware
 * Enforces subscription tier requirements for premium features
 */

// Canonical paid tiers, ranked by price (see SUBSCRIPTION_TIERS in
// services/credits.ts: creator $9.99 < pro $29.99 < studio $79.99). These are
// the values actually written to users.subscription_tier by the Stripe webhook.
export type SubscriptionTier = 'free' | 'creator' | 'pro' | 'studio';

const TIER_LEVELS: Record<SubscriptionTier, number> = {
  free: 0,
  creator: 1,
  pro: 2,
  studio: 3,
};

// A userSubscriptions.status that means the paid tier is currently entitled.
// Anything else (canceled, past_due, incomplete, unpaid…) drops the user to free.
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/**
 * Resolve a user's EFFECTIVE tier.
 *
 * The entitlement lives in `user.subscriptionTier` (free|creator|pro|studio) —
 * NOT in the subscription's Stripe *lifecycle* status. The prior code cast
 * `subscription.status` ("active") straight to a tier, and since "active" is not
 * a key in TIER_LEVELS it silently resolved to free level 0, 403-ing every
 * paying customer (audit 2026-08-02, finding #2).
 *
 * The status only gates VALIDITY: if a subscription row exists, the paid tier is
 * honored only while that row is active/trialing. With no row we fall back to the
 * stored tier so manual/activation-key grants still work.
 */
function resolveTier(
  user: { subscriptionTier?: string | null },
  subscription: { status?: string | null } | null | undefined,
): SubscriptionTier {
  const stored = (user.subscriptionTier || 'free') as SubscriptionTier;
  if (!(stored in TIER_LEVELS)) return 'free';
  if (stored === 'free') return 'free';
  // Paid tier stored — valid only if there's no gating row, or the row is active.
  if (!subscription) return stored;
  return ACTIVE_STATUSES.has(subscription.status || '') ? stored : 'free';
}

/**
 * Middleware to require a minimum subscription tier
 * Usage: router.post('/endpoint', requireAuth(), requireTier('pro'), handler)
 */
export function requireTier(minTier: SubscriptionTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Must be authenticated first
      if (!(req as any).userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please log in to access this feature',
        });
      }

      // Get user and subscription
      const user = await storage.getUser((req as any).userId);
      if (!user) {
        return res.status(401).json({
          error: 'User not found',
          message: 'Invalid user session',
        });
      }

      // Get subscription tier
      const subscription = await storage.getUserSubscription(user.id);
      const userTier = resolveTier(user, subscription);

      // Check if user meets minimum tier requirement
      const userLevel = TIER_LEVELS[userTier] || 0;
      const requiredLevel = TIER_LEVELS[minTier];

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          error: 'Upgrade required',
          message: `This feature requires ${minTier} tier or higher`,
          currentTier: userTier,
          requiredTier: minTier,
          upgradeUrl: '/settings/subscription',
        });
      }

      // Store user info for rate limiters
      (req as any).user = user;
      next();
    } catch (error) {
      console.error('Tier enforcement error:', error);
      return res.status(500).json({
        error: 'Server error',
        message: 'Failed to verify subscription tier',
      });
    }
  };
}

/**
 * Check if user has access to a feature (non-blocking, returns boolean)
 */
export async function hasAccess(userId: string, requiredTier: SubscriptionTier): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return false;

    const subscription = await storage.getUserSubscription(userId);
    const userTier = resolveTier(user, subscription);

    const userLevel = TIER_LEVELS[userTier] || 0;
    const requiredLevel = TIER_LEVELS[requiredTier];

    return userLevel >= requiredLevel;
  } catch (error) {
    console.error('Access check error:', error);
    return false;
  }
}

/**
 * Get user's current tier
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return 'free';

    const subscription = await storage.getUserSubscription(userId);
    return resolveTier(user, subscription);
  } catch (error) {
    console.error('Get tier error:', error);
    return 'free';
  }
}

/**
 * Feature limits by tier
 */
export const TIER_LIMITS: Record<SubscriptionTier, {
  aiGenerationsPerMonth: number;
  songsPerMonth: number;
  lyricsPerMonth: number;
  beatsPerMonth: number;
  uploadsPerMonth: number;
  maxProjectSize: number;
  maxSongDuration: number;
}> = {
  free: {
    aiGenerationsPerMonth: 10,
    songsPerMonth: 5,
    lyricsPerMonth: 20,
    beatsPerMonth: 30,
    uploadsPerMonth: 20,
    maxProjectSize: 50 * 1024 * 1024, // 50MB
    maxSongDuration: 180, // 3 minutes
  },
  creator: {
    aiGenerationsPerMonth: 50,
    songsPerMonth: 20,
    lyricsPerMonth: 100,
    beatsPerMonth: 150,
    uploadsPerMonth: 60,
    maxProjectSize: 250 * 1024 * 1024, // 250MB
    maxSongDuration: 420, // 7 minutes
  },
  pro: {
    aiGenerationsPerMonth: 100,
    songsPerMonth: 50,
    lyricsPerMonth: 200,
    beatsPerMonth: 300,
    uploadsPerMonth: 100,
    maxProjectSize: 500 * 1024 * 1024, // 500MB
    maxSongDuration: 600, // 10 minutes
  },
  studio: {
    aiGenerationsPerMonth: -1, // Unlimited
    songsPerMonth: -1,
    lyricsPerMonth: -1,
    beatsPerMonth: -1,
    uploadsPerMonth: -1,
    maxProjectSize: 2 * 1024 * 1024 * 1024, // 2GB
    maxSongDuration: -1, // Unlimited
  },
};

/**
 * Get limits for a user's tier
 */
export async function getUserLimits(userId: string) {
  const tier = await getUserTier(userId);
  return TIER_LIMITS[tier];
}
