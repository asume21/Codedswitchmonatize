import type { Request, Response } from "express";
import { handleStripeWebhook } from "../services/stripe";
import type { IStorage } from "../storage";

export function stripeWebhookHandler(storage: IStorage) {
  return async function handler(req: Request, res: Response) {
    try {
      const signature = req.headers["stripe-signature"];
      const payload = req.body as Buffer;
      const result = await handleStripeWebhook(storage, payload, signature);
      res.json(result);
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(400).send(`Webhook Error: ${error?.message || "unknown error"}`);
    }
  };
}
