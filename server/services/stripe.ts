import Stripe from "stripe";
import type { IStorage } from "../storage";
import { getCreditService, CREDIT_PACKAGES } from "./credits";
import { generateActivationKey } from "./keyGenerator";
import { sendActivationKeyEmail } from "./email";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('APP_URL is required in production'); })()
  : "http://localhost:5000");
const PRICE_ID = process.env.STRIPE_PRICE_ID_PRO_MEMBERSHIP || process.env.STRIPE_PRICE_ID_PRO || "";
const SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL || `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL = process.env.STRIPE_CANCEL_URL || `${APP_URL}/billing/cancel`;

// M-M2: Single source of truth for the Stripe API version. Previously this
// string was duplicated in services/stripe.ts and routes/credits.ts; an upgrade
// to one would silently leave the other on a stale version.
export const STRIPE_API_VERSION = "2025-08-27.basil" as const;

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

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  const sig = Array.isArray(signature) ? signature[0] : signature || "";

  const event = Stripe.webhooks.constructEvent(payload, sig, webhookSecret);

  // M-C2 / M-H4: every handled branch claims the event up-front via the unique
  // index on processed_stripe_events. If claim returns false, the event was
  // already processed (Stripe retry, manual replay, race) and we no-op.
  // Helper closure keeps the signature compact at call sites.
  async function claimEvent(extra: { userId?: string; paymentIntentId?: string } = {}): Promise<boolean> {
    return storage.tryClaimStripeEvent({
      eventId: event.id,
      eventType: event.type,
      userId: extra.userId,
      paymentIntentId: extra.paymentIntentId,
      processedAt: new Date(),
    });
  }

  // Audit 2026-04-30: claim + execute + release-on-failure. Without the
  // release, a throw inside `work()` leaves the claim row committed so
  // Stripe's retry sees a "processed" row and skips — the user permanently
  // loses the credit grant or subscription update. Releasing on failure
  // lets the retry try again with a fresh claim.
  async function withClaim(
    extra: { userId?: string; paymentIntentId?: string } | undefined,
    work: () => Promise<void>,
  ): Promise<{ claimed: boolean }> {
    if (!(await claimEvent(extra))) {
      console.log(`⚡ Skipping duplicate ${event.type} ${event.id}`);
      return { claimed: false };
    }
    try {
      await work();
      return { claimed: true };
    } catch (err) {
      await storage.releaseStripeEvent(event.id);
      throw err;
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = (session.customer as string) || undefined;
      const subscriptionId = (session.subscription as string) || undefined;
      let userId = (session.metadata && (session.metadata as any).userId) || undefined;

      if (!customerId) {
        throw new Error("Missing customer on checkout session");
      }

      if (!userId && customerId) {
        const user = await storage.getUserByStripeCustomerId(customerId);
        userId = user?.id;
      }

      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : undefined;

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

        if (!packageKey || !credits || !paymentIntentId) {
          throw new Error(
            `Invalid credit purchase metadata (packageKey=${String(
              packageKey,
            )}, credits=${String(credits)}, paymentIntentId=${String(paymentIntentId)})`,
          );
        }

        await withClaim({ userId, paymentIntentId }, async () => {
          const creditService = getCreditService(storage);
          await creditService.purchaseCredits(userId, packageKey, paymentIntentId);
          console.log(
            `💳 Credits purchased via webhook: User ${userId}, +${credits} credits (${packageKey})`,
          );
        });
      }

      // Handle subscription checkouts
      if (userId && customerId && subscriptionId) {
        await withClaim({ userId, paymentIntentId }, async () => {
          await storage.upsertUserSubscription({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status,
            currentPeriodEnd,
          });

          const tier = metadataTier || deriveTier(status);
          const activationKey = generateActivationKey("pro");

          await storage.updateUserStripeInfo(userId, {
            customerId,
            subscriptionId,
            status,
            tier,
          });
          await storage.setUserActivationKey(userId, activationKey);

          const user = await storage.getUser(userId);
          if (user?.email) {
            const emailSent = await sendActivationKeyEmail(user.email, activationKey, user.username || undefined);
            if (emailSent) {
              console.log(`Activation key email sent successfully to user ${userId}`);
            } else {
              console.log(`Activation key generated for user ${userId} but email delivery failed`);
            }
          } else {
            console.log(`Activation key generated for user ${userId} (no email on file)`);
          }
        });
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
          await withClaim({ userId }, async () => {
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
      await withClaim({ userId: user.id }, async () => {
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
      });
      break;
    }

    case "charge.refunded":
    case "charge.dispute.created": {
      // M-H1: claw back credits granted via the disputed/refunded charge so
      // refunds and chargebacks don't leave free credits in the user's account.
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
      const customerId = (charge.customer as string) || undefined;

      if (!paymentIntentId) break;

      const user = customerId
        ? await storage.getUserByStripeCustomerId(customerId)
        : undefined;
      if (!user) break;

      // Find the original credit-purchase transaction for this paymentIntent.
      // Scanning recent history is acceptable here — refunds are rare and we
      // need only one match. If more rigor is needed later, add an indexed
      // lookup by metadata->>'paymentIntentId'.
      const recent = await storage.getCreditTransactions(user.id, 500, 0);
      const original = recent.find((t: any) => {
        const meta = (t as any)?.metadata;
        return meta?.paymentIntentId === paymentIntentId && (t as any).amount > 0;
      });
      if (!original) {
        console.warn(
          `Refund/dispute received for ${paymentIntentId} but no matching purchase found`,
        );
        break;
      }

      const clawbackAmount = Math.abs((original as any).amount);
      await withClaim({ userId: user.id, paymentIntentId }, async () => {
        // Use atomicAddCredits with a negative delta — the same SQL UPDATE that
        // grants credits is also race-safe for clawback. We deliberately allow
        // the balance to go negative; the next `requireCredits` check will block
        // further AI work until the user buys more.
        const { balanceBefore, balanceAfter } = await storage.atomicAddCredits(
          user.id,
          -clawbackAmount,
        );
        await storage.logCreditTransaction({
          id: crypto.randomUUID(),
          userId: user.id,
          amount: -clawbackAmount,
          type: "refund" as any,
          reason: event.type === "charge.refunded" ? "Stripe refund clawback" : "Stripe dispute clawback",
          balanceBefore,
          balanceAfter,
          metadata: {
            stripeEventId: event.id,
            paymentIntentId,
            originalTransactionId: (original as any).id,
          },
          createdAt: new Date(),
        });
        console.log(
          `↩️ Clawed back ${clawbackAmount} credits from user ${user.id} for ${event.type}`,
        );
      });
      break;
    }

    default:
      // No-op for unhandled events
      break;
  }

  return { received: true, type: event.type, eventId: event.id };
}
