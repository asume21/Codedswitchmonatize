import Stripe from "stripe";
import type { IStorage } from "../storage";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:5000";
const PRICE_ID = process.env.STRIPE_PRICE_ID_PRO || "";

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });
}

export async function createCheckoutSession(storage: IStorage, userId: string) {
  const stripe = getStripe();
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  if (!PRICE_ID) throw new Error("STRIPE_PRICE_ID_PRO is not set");

  let customerId = user.stripeCustomerId || undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await storage.updateUserStripeInfo(userId, { customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/billing/cancel`,
    metadata: { userId },
  });

  return { url: session.url };
}

export async function handleStripeWebhook(
  storage: IStorage,
  payload: Buffer,
  signature: string | string[] | undefined,
) {
  const stripe = getStripe();
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  const sig = Array.isArray(signature) ? signature[0] : signature || "";

  const event = stripe.webhooks.constructEvent(payload, sig, STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = (session.customer as string) || undefined;
      const subscriptionId = (session.subscription as string) || undefined;
      let userId = (session.metadata && (session.metadata as any).userId) || undefined;

      // Try to locate by metadata userId or fallback to customerId
      if (!userId && customerId) {
        const user = await storage.getUserByStripeCustomerId(customerId);
        userId = user?.id;
      }

      if (userId && customerId && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const status = sub.status;
        const tier = status === "active" || status === "trialing" ? "pro" : "free";
        await storage.updateUserStripeInfo(userId, {
          customerId,
          subscriptionId,
          status,
          tier,
        });
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as string) || undefined;
      const subscriptionId = sub.id;
      if (!customerId) break;
      const user = await storage.getUserByStripeCustomerId(customerId);
      if (!user) break;
      const status = sub.status;
      const tier = status === "active" || status === "trialing" ? "pro" : "free";
      await storage.updateUserStripeInfo(user.id, {
        customerId,
        subscriptionId,
        status,
        tier,
      });
      break;
    }

    default:
      // No-op for unhandled events
      break;
  }

  return { received: true };
}
