import { Router } from "express";
import { createCheckoutSession } from "../services/stripe";
import { requireAuth } from "../middleware/auth";
import type { IStorage } from "../storage";
import type { Request, Response } from "express";

export function billingRoutes(storage: IStorage) {
  const router = Router();

  // Create Stripe Checkout Session
  router.post("/create-checkout-session", requireAuth, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const { tier } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!tier || !['basic', 'pro'].includes(tier)) {
        return res.status(400).json({ error: "Valid tier required (basic or pro)" });
      }

      const result = await createCheckoutSession(storage, userId);
      res.json(result);
    } catch (error) {
      console.error("Checkout session creation failed:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Success page redirect
  router.get("/success", async (req, res) => {
    const { session_id } = req.query;
    
    if (session_id) {
      // Redirect to studio with success message
      res.redirect(`/studio?payment=success&session=${session_id}`);
    } else {
      res.redirect("/studio?payment=success");
    }
  });

  // Cancel page redirect
  router.get("/cancel", async (req, res) => {
    res.redirect("/subscribe?payment=cancelled");
  });

  return router;
}
