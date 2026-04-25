import type { Request, Response } from "express";
import { handleStripeWebhook } from "../services/stripe";
import type { IStorage } from "../storage";
import { captureError, logger } from "../lib/logger";

export function stripeWebhookHandler(storage: IStorage) {
  const log = logger.child({ component: "stripe-webhook" });

  return async function handler(req: Request, res: Response) {
    const signature = req.headers["stripe-signature"];
    const payload = req.body as Buffer;

    try {
      const result = await handleStripeWebhook(storage, payload, signature);
      log.info(
        { eventType: (result as { type?: string })?.type, payloadBytes: payload?.length },
        "stripe webhook processed",
      );
      res.json(result);
    } catch (err) {
      await captureError(err, {
        component: "stripe-webhook",
        hasSignature: Boolean(signature),
        payloadBytes: payload?.length,
        msg: "stripe webhook failed",
      });
      const message = err instanceof Error ? err.message : "unknown error";
      res.status(400).send(`Webhook Error: ${message}`);
    }
  };
}
