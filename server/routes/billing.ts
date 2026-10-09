// Extracted from server/routes.ts — order and behavior preserved.
import { Router, type Request, type Response } from "express";
import { checkLicenseHandler } from "../api/check-license";
import { stripeWebhookHandler } from "../api/webhook";
import { requireAuth } from "../middleware/auth";
import type { IStorage } from "../storage";

export function createBillingRoutes(storage: IStorage) {
  const router = Router();
  // Legacy direct credit purchase endpoint.
  // Revenue safety: do not grant credits from an authenticated POST body. All
  // paid credit purchases must go through Stripe Checkout and the signed
  // webhook path in createCreditRoutes().
  router.post("/api/credits/purchase", requireAuth(), async (req: Request, res: Response) => {
    return res.status(410).json({
      error: "Legacy purchase endpoint disabled",
      message: "Use /api/credits/purchase-checkout to create a Stripe Checkout session.",
      checkoutEndpoint: "/api/credits/purchase-checkout",
    });
  });

  // License check. Checkout lives in createCreditRoutes (purchase-checkout /
  // membership-checkout) — the three legacy aliases that sold Pro without tier
  // metadata were removed (review F6).
  router.get("/api/check-license", checkLicenseHandler(storage));
  // Stripe Webhook - raw body is provided by express.raw mounted in index.ts
  router.post("/api/webhooks/stripe", stripeWebhookHandler(storage));

  return router;
}
