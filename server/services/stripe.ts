import Stripe from "stripe";
import type { IStorage } from "../storage";
import crypto from "crypto";
import { getCreditService, CREDIT_PACKAGES } from "./credits";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:5000";
const PRICE_ID = process.env.STRIPE_PRICE_ID_PRO || "";
const SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL || `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL = process.env.STRIPE_CANCEL_URL || `${APP_URL}/billing/cancel`;

// Generate cryptographically secure activation key
function generateActivationKey(): string {
  const prefix = "CS"; // CodedSwitch
  const randomPart = crypto.randomBytes(16).toString("hex").toUpperCase();
  // Format: CS-XXXX-XXXX-XXXX-XXXX
  return `${prefix}-${randomPart.slice(0, 4)}-${randomPart.slice(4, 8)}-${randomPart.slice(
    8,
    12,
  )}-${randomPart.slice(12, 16)}`;
}

function deriveTier(status?: string | null) {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

function normalizeTier(raw?: unknown): string | undefined {
  if (!raw) return undefined;
  const value = String(raw).toLowerCase();
  if (value === 'creator' || value === 'pro' || value === 'studio' || value === 'free') {
    return value;
  }
  return undefined;
}

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
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
    payment_method_types: ["card"],
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
    },
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

      if (!customerId) {
        throw new Error("Missing customer on checkout session");
      }

      // Try to locate by metadata userId or fallback to customerId
      if (!userId && customerId) {
        const user = await storage.getUserByStripeCustomerId(customerId);
        userId = user?.id;
      }

      const subscriptionResponse =
        subscriptionId && subscriptionId.length > 0
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : undefined;
      const subscription = subscriptionResponse as Stripe.Subscription | undefined;
      const status = subscription?.status || "active";
      const currentPeriodEnd = (subscription as any)?.current_period_end
        ? new Date((subscription as any).current_period_end * 1000)
        : null;

      const metadataTier =
        normalizeTier((session.metadata as any)?.tier) ||
        normalizeTier((subscription as any)?.metadata?.tier);

      // Handle credit purchases (one-time payments)
      if (session.mode === "payment" && userId) {
        const packageKey = session.metadata?.packageKey as keyof typeof CREDIT_PACKAGES;
        const credits = parseInt(session.metadata?.credits || "0");
        const paymentIntentId = session.payment_intent as string;

        if (!packageKey || !credits || !paymentIntentId) {
          throw new Error(
            `Invalid credit purchase metadata (packageKey=${String(
              packageKey,
            )}, credits=${String(credits)}, paymentIntentId=${String(paymentIntentId)})`,
          );
        }

        const recent = await storage.getCreditTransactions(userId, 200, 0);
        const alreadyProcessed = recent.some((t: any) => {
          const meta = (t as any)?.metadata;
          return meta && meta.paymentIntentId === paymentIntentId;
        });

        if (!alreadyProcessed) {
          const creditService = getCreditService(storage);
          await creditService.purchaseCredits(userId, packageKey, paymentIntentId);
          console.log(
            `?? Credits purchased via webhook: User ${userId}, +${credits} credits (${packageKey})`,
          );
        }
      }

      // Handle subscription checkouts
      if (userId && customerId && subscriptionId) {
        await storage.upsertUserSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status,
          currentPeriodEnd,
        });

        const tier = metadataTier || deriveTier(status);

        // Generate activation key for new pro subscribers
        const activationKey = generateActivationKey();
        console.log(`?? Generated activation key for user ${userId}: ${activationKey}`);

        // Update user with Stripe info AND activation key
        await storage.updateUserStripeInfo(userId, {
          customerId,
          subscriptionId,
          status,
          tier,
        });
        await storage.setUserActivationKey(userId, activationKey);
        console.log(`?? TODO: Email activation key ${activationKey} to user`);
      }
      break;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof (invoice as any).subscription === "string"
          ? ((invoice as any).subscription as string)
          : ((invoice as any).subscription?.id as string | undefined);
      const customerId = (invoice.customer as string) || undefined;

      if (subscriptionId) {
        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
        const subscription = subscriptionResponse as Stripe.Subscription;
        const status = subscription.status || (event.type === "invoice.paid" ? "active" : "past_due");
        const currentPeriodEnd = (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000)
          : null;

        const metadataTier = normalizeTier((subscription as any)?.metadata?.tier);

        const updatedRecord = await storage.updateSubscriptionStatusByStripeId(
          subscriptionId,
          status,
          currentPeriodEnd,
        );

        const userId =
          updatedRecord?.userId ||
          (customerId ? (await storage.getUserByStripeCustomerId(customerId))?.id : undefined);

        if (userId) {
          await storage.upsertUserSubscription({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status,
            currentPeriodEnd,
          });
          await storage.updateUserStripeInfo(userId, {
            customerId: customerId || undefined,
            subscriptionId,
            status,
            tier: metadataTier || deriveTier(status),
          });
        }
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
      const tier = deriveTier(status);
      const currentPeriodEnd = (sub as any).current_period_end
        ? new Date((sub as any).current_period_end * 1000)
        : null;
      await storage.upsertUserSubscription({
        userId: user.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status,
        currentPeriodEnd,
      });
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
