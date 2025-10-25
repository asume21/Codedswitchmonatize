import type { Request, Response, NextFunction } from "express";
import type { IStorage } from "../storage";

export function currentUser(storage: IStorage) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // If session has a userId, attach it
      if (req.session?.userId) {
        req.userId = req.session.userId;
        return next();
      }

      // Fallback: Check Authorization header for userId (format: "Bearer userId")
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const userId = authHeader.substring(7);
        if (userId) {
          req.userId = userId;
          return next();
        }
      }

      // No auto-login - users must activate with a key
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow owner users to bypass auth
    if (req.userId === 'owner-user') {
      return next();
    }
    
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };
}

export function requireSubscription(
  storage: IStorage,
  options?: { allowedTiers?: string[]; allowTrialing?: boolean },
) {
  const allowedTiers = options?.allowedTiers ?? ["pro"]; // default: pro only
  const allowTrialing = options?.allowTrialing ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(req.userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const status = user.subscriptionStatus || "";
      const tier = user.subscriptionTier || "free";

      const isActive = status === "active" || (allowTrialing && status === "trialing");
      const tierAllowed = allowedTiers.includes(tier);

      if (!isActive || !tierAllowed) {
        const upgradeUrl = (process.env.APP_URL || "http://localhost:5000") + "/billing";
        return res.status(402).json({
          message: "Subscription required",
          subscriptionStatus: user.subscriptionStatus,
          subscriptionTier: user.subscriptionTier,
          upgradeUrl,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
