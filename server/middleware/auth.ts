import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import type { IStorage } from "../storage";
import { verifyUserToken } from "../lib/jwt";

const MIN_OWNER_KEY_LENGTH = 32;

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function currentUser(storage: IStorage) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const isPlaywright = process.env.PLAYWRIGHT === 'true' || process.env.NODE_ENV === 'test';
      // Check for owner key (x-owner-key header) — constant-time compare + length floor.
      // An OWNER_KEY shorter than MIN_OWNER_KEY_LENGTH is treated as unset to prevent
      // weak/empty values from silently granting admin access.
      const rawOwnerKey = req.headers['x-owner-key'];
      const ownerKey = typeof rawOwnerKey === 'string' ? rawOwnerKey : '';
      const expectedOwnerKey = process.env.OWNER_KEY || '';

      if (
        ownerKey &&
        expectedOwnerKey.length >= MIN_OWNER_KEY_LENGTH &&
        safeEqualString(ownerKey, expectedOwnerKey)
      ) {
        req.userId = 'owner-user';
        req.isOwner = true;
        console.log(`🔑 owner-key auth: ${req.method} ${req.path}`);
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

      // Dev-only convenience: structurally impossible to enable in production so that
      // a stray ENABLE_DEV_AUTO_LOGIN=true in a prod env cannot silently auth every
      // request as DEV_USER_ID. Guard has to be the literal NODE_ENV check, not just
      // the env flag.
      const isProduction = process.env.NODE_ENV === 'production';
      const devAutoLoginEnabled =
        !isProduction &&
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
