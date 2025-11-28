import type { Request, Response } from "express";
import { createCheckoutSession } from "../services/stripe";
import type { IStorage } from "../storage";

export function createCheckoutHandler(storage: IStorage) {
  return async function handler(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const session = await createCheckoutSession(storage, userId);
      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Create checkout session failed:", error);
      return res
        .status(400)
        .json({ error: error?.message || "Unable to create checkout session" });
    }
  };
}
