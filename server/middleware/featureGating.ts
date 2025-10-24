import type { Request, Response, NextFunction } from "express";
import type { IStorage } from "../storage";
import { getTierLimits, type UserTier } from "../../shared/tiers";

export function requireFeature(storage: IStorage, feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ 
          message: "Please activate your account to use this feature",
          requiresActivation: true 
        });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Determine user tier
      let tier: UserTier = 'free';
      if (req.userId === 'owner-user') {
        tier = 'owner';
      } else if (user.activationKey && user.activatedAt) {
        tier = 'pro';
      }

      const limits = getTierLimits(tier);

      // Check specific feature access
      switch (feature) {
        case 'song-upload':
          if (user.monthlyUploads >= limits.maxSongUploads) {
            return res.status(403).json({
              message: `You've reached your upload limit (${limits.maxSongUploads}/month). Upgrade to Pro for more uploads.`,
              tier,
              limit: limits.maxSongUploads,
              current: user.monthlyUploads,
              upgradeUrl: '/activate'
            });
          }
          break;

        case 'song-analysis':
          if (!limits.enableSongAnalysis) {
            return res.status(403).json({
              message: "Song analysis is a Pro feature. Activate your account to access it.",
              tier,
              upgradeUrl: '/activate'
            });
          }
          break;

        case 'advanced-sequencer':
          if (!limits.enableAdvancedSequencer) {
            return res.status(403).json({
              message: "Advanced Sequencer is a Pro feature. Activate your account to access it.",
              tier,
              upgradeUrl: '/activate'
            });
          }
          break;

        case 'granular-engine':
          if (!limits.enableGranularEngine) {
            return res.status(403).json({
              message: "Granular Engine is a Pro feature. Activate your account to access it.",
              tier,
              upgradeUrl: '/activate'
            });
          }
          break;

        case 'vulnerability-scan':
          if (!limits.enableVulnerabilityScanning) {
            return res.status(403).json({
              message: "Vulnerability scanning is a Pro feature. Activate your account to access it.",
              tier,
              upgradeUrl: '/activate'
            });
          }
          break;

        default:
          // Feature not gated, allow access
          break;
      }

      // Attach tier info to request for other middleware
      (req as any).userTier = tier;
      (req as any).tierLimits = limits;

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function checkUsageLimit(storage: IStorage, limitType: 'uploads' | 'generations') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Owner has unlimited
      if (req.userId === 'owner-user') {
        return next();
      }

      // Determine tier
      const tier: UserTier = (user.activationKey && user.activatedAt) ? 'pro' : 'free';
      const limits = getTierLimits(tier);

      // Check limit
      if (limitType === 'uploads') {
        if (user.monthlyUploads >= limits.maxSongUploads) {
          return res.status(403).json({
            message: `Monthly upload limit reached (${limits.maxSongUploads}). Upgrade to Pro for more.`,
            tier,
            upgradeUrl: '/activate'
          });
        }
      } else if (limitType === 'generations') {
        if (user.monthlyGenerations >= limits.maxBeatGenerations) {
          return res.status(403).json({
            message: `Monthly generation limit reached. Upgrade to Pro for unlimited generations.`,
            tier,
            upgradeUrl: '/activate'
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
