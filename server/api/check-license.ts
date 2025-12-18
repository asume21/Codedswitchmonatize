import type { Request, Response } from "express";
import type { IStorage } from "../storage";

function isActive(status?: string | null) {
  return status === "active" || status === "trialing";
}

export function checkLicenseHandler(storage: IStorage) {
  return async function handler(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.json({
          isPro: false,
          status: "none",
          reason: "unauthenticated",
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({
          isPro: false,
          status: "none",
          reason: "user_not_found",
        });
      }

      // Check for owner bypass (same logic as requireCredits middleware)
      let isOwner = (req as any).isOwner || false;
      if (userId === 'owner-user') {
        isOwner = true;
      } else if (process.env.OWNER_EMAIL) {
        const ownerEmail = process.env.OWNER_EMAIL.toLowerCase();
        if (user.email && user.email.toLowerCase() === ownerEmail) {
          isOwner = true;
        }
      }

      // Owner always has Pro access
      if (isOwner) {
        return res.json({
          isPro: true,
          status: "owner",
          isOwner: true,
        });
      }

      const subscription = await storage.getUserSubscription(userId);
      const status = subscription?.status || user.subscriptionStatus || null;
      const isPro =
        isActive(status) ||
        user.subscriptionTier === "pro" ||
        user.subscriptionStatus === "active";

      return res.json({
        isPro,
        status: status || "none",
        currentPeriodEnd: subscription?.currentPeriodEnd || null,
        stripeCustomerId: subscription?.stripeCustomerId || user.stripeCustomerId,
        stripeSubscriptionId: subscription?.stripeSubscriptionId || user.stripeSubscriptionId,
      });
    } catch (error: any) {
      console.error("License check failed:", error);
      return res.status(500).json({
        isPro: false,
        status: "error",
        reason: error?.message || "unknown_error",
      });
    }
  };
}
