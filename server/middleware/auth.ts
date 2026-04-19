import type { Request, Response, NextFunction } from "express";
import type { IStorage } from "../storage";
import { verifyUserToken } from "../lib/jwt";

export function currentUser(storage: IStorage) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const isPlaywright = process.env.PLAYWRIGHT === 'true' || process.env.NODE_ENV === 'test';
      // Check for owner key (x-owner-key header)
      const ownerKey = req.headers['x-owner-key'];
      const expectedOwnerKey = process.env.OWNER_KEY;
      
      if (ownerKey && expectedOwnerKey && ownerKey === expectedOwnerKey) {
        req.userId = 'owner-user';
        req.isOwner = true;
        return next();
      }

      // If session has a userId, attach it
      if (req.session?.userId) {
        req.userId = req.session.userId;
        return next();
      }

      // Fallback: Authorization header carries a signed JWT (format: "Bearer <jwt>").
      // JWT proves the token was issued by us; we then verify the user still exists.
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const userId = token ? verifyUserToken(token) : null;
        if (userId) {
          try {
            const user = await storage.getUser(userId);
            if (user) {
              req.userId = userId;
              return next();
            }
          } catch {
            // User lookup failed — fall through to unauthenticated
          }
        }
      }

      // No auto-login - users must activate with a key
      // Dev-only convenience: allow local testing without a full auth flow.
      // Enabled by default in non-production; set DISABLE_DEV_AUTO_LOGIN=true to turn off.
      // Optionally set DEV_USER_ID to control which userId is used.
      const devAutoLoginEnabled =
        !isPlaywright &&
        process.env.ENABLE_DEV_AUTO_LOGIN === 'true';
      if (devAutoLoginEnabled) {
        req.userId = process.env.DEV_USER_ID?.trim() || 'dev-user';
      }
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

/**
 * Blanket auth middleware — protects all /api/* routes except explicitly listed public paths.
 * Mount AFTER currentUser() so req.userId is already set.
 */
export function requireAuthExcept(publicPrefixes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow non-API routes (static files, HTML pages) through
    if (!req.path.startsWith("/api")) return next();

    // Check if this path matches any public prefix
    const isPublic = publicPrefixes.some((prefix) => req.path.startsWith(prefix));
    if (isPublic) return next();

    // Require authentication for everything else
    if (!req.userId) {
      return res.status(401).json({ message: "Authentication required" });
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
        if (!process.env.APP_URL && process.env.NODE_ENV === 'production') {
          console.error('❌ APP_URL not set — upgrade redirect URL is wrong');
        }
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
