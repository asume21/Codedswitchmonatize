import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * Tier-based Access Control Middleware
 * Enforces subscription tier requirements for premium features
 */

export type SubscriptionTier = 'free' | 'pro' | 'premium';

const TIER_LEVELS: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

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
      const userTier = (subscription?.status as SubscriptionTier) || user.subscriptionTier || 'free';

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
    const userTier = (subscription?.status as SubscriptionTier) || user.subscriptionTier || 'free';

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
    return (subscription?.status as SubscriptionTier) || user.subscriptionTier || 'free';
  } catch (error) {
    console.error('Get tier error:', error);
    return 'free';
  }
}

/**
 * Feature limits by tier
 */
export const TIER_LIMITS = {
  free: {
    aiGenerationsPerMonth: 10,
    songsPerMonth: 5,
    lyricsPerMonth: 20,
    beatsPerMonth: 30,
    uploadsPerMonth: 20,
    maxProjectSize: 50 * 1024 * 1024, // 50MB
    maxSongDuration: 180, // 3 minutes
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
  premium: {
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
