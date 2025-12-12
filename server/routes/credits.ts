/**
 * Credit System API Routes
 * Handles credit balance, history, and purchases
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import type { IStorage } from '../storage';
import { getCreditService, CREDIT_COSTS, CREDIT_PACKAGES, MEMBERSHIP_TIERS } from '../services/credits';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
  });
}

export function createCreditRoutes(storage: IStorage) {
  const router = Router();
  const creditService = getCreditService(storage);

  /**
   * GET /api/credits/balance
   * Get current credit balance
   */
  router.get('/balance', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Determine owner/infinite credits state
      let isOwner = req.isOwner || req.userId === 'owner-user';
      if (!isOwner && process.env.OWNER_EMAIL) {
        try {
          const user = await storage.getUser(req.userId);
          const ownerEmail = process.env.OWNER_EMAIL.toLowerCase();
          if (user?.email && user.email.toLowerCase() === ownerEmail) {
            isOwner = true;
          }
        } catch (e) {
          console.warn('Owner email check failed:', e);
        }
      }

      if (isOwner) {
        return res.json({
          balance: Number.MAX_SAFE_INTEGER,
          userId: req.userId,
          isOwner: true,
          creditInfinite: true,
        });
      }

      const balance = await creditService.getBalance(req.userId);
      
      res.json({ 
        balance,
        userId: req.userId,
        isOwner: false,
        creditInfinite: false,
      });
    } catch (error) {
      console.error('Get balance error:', error);
      res.status(500).json({ error: 'Failed to fetch credit balance' });
    }
  });

  /**
   * GET /api/credits/stats
   * Get credit usage statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await creditService.getUsageStats(req.userId);
      
      res.json(stats);
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch credit statistics' });
    }
  });

  /**
   * GET /api/credits/history
   * Get credit transaction history
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const transactions = await creditService.getTransactionHistory(
        req.userId,
        limit,
        offset
      );
      
      res.json({ 
        transactions,
        limit,
        offset,
        count: transactions.length
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ error: 'Failed to fetch credit history' });
    }
  });

  /**
   * GET /api/credits/costs
   * Get credit costs for all operations
   */
  router.get('/costs', (req: Request, res: Response) => {
    res.json({
      costs: CREDIT_COSTS,
      packages: Object.entries(CREDIT_PACKAGES).map(([key, pkg]) => ({
        key,
        ...pkg,
        priceFormatted: `$${(pkg.price / 100).toFixed(2)}`
      }))
    });
  });

  /**
   * POST /api/credits/grant-monthly
   * Grant monthly credits to pro subscribers (admin/owner only)
   */
  router.post('/grant-monthly', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only owner can grant monthly credits
      const isOwner = req.isOwner || req.userId === 'owner-user';
      if (!isOwner) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Allow granting to a specific user via body, or self
      const targetUserId = req.body.userId || req.userId;
      await creditService.grantMonthlyCredits(targetUserId);
      
      const newBalance = await creditService.getBalance(targetUserId);
      
      res.json({ 
        message: 'Monthly credits granted successfully',
        newBalance
      });
    } catch (error: any) {
      console.error('Grant monthly credits error:', error);
      res.status(400).json({ error: error.message || 'Failed to grant monthly credits' });
    }
  });

  /**
   * POST /api/credits/refund
   * Refund credits for a transaction (admin/owner only)
   */
  router.post('/refund', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only owner can issue refunds
      const isOwner = req.isOwner || req.userId === 'owner-user';
      if (!isOwner) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const schema = z.object({
        transactionId: z.string(),
        reason: z.string(),
        userId: z.string().optional() // Allow refunding for specific user
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid input', 
          details: parsed.error.errors 
        });
      }

      const { transactionId, reason, userId } = parsed.data;

      // Use provided userId or fall back to requester
      const targetUserId = userId || req.userId;
      const transaction = await creditService.refundCredits(
        targetUserId,
        transactionId,
        reason
      );
      
      res.json({ 
        message: 'Credits refunded successfully',
        transaction
      });
    } catch (error: any) {
      console.error('Refund error:', error);
      res.status(400).json({ error: error.message || 'Failed to refund credits' });
    }
  });

  /**
   * POST /api/credits/purchase-checkout
   * Create Stripe checkout session for credit purchase
   */
  router.post('/purchase-checkout', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        packageKey: z.enum(['STARTER', 'POPULAR', 'PRO', 'ENTERPRISE'])
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid package key', 
          details: parsed.error.errors 
        });
      }

      const { packageKey } = parsed.data;
      const creditPackage = CREDIT_PACKAGES[packageKey];

      console.log(`[PURCHASE] Package: ${packageKey}, Price ID: ${creditPackage.priceId || 'MISSING'}`);
      console.log(`[PURCHASE] Full package:`, creditPackage);

      if (!creditPackage.priceId) {
        return res.status(500).json({ 
          error: `Stripe price ID not configured for ${packageKey}` 
        });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const stripe = getStripe();

      const stripePrice = await stripe.prices.retrieve(creditPackage.priceId);
      const stripeUnitAmount = (stripePrice as any)?.unit_amount as number | null | undefined;
      const isRecurring = Boolean((stripePrice as any)?.recurring);
      if (isRecurring) {
        return res.status(500).json({
          error: `Stripe price for ${packageKey} is recurring but credit purchases require a one-time price. Check STRIPE_PRICE_ID_*_CREDITS env vars.`,
        });
      }
      if (typeof stripeUnitAmount === 'number' && stripeUnitAmount !== creditPackage.price) {
        return res.status(500).json({
          error: `Stripe price amount mismatch for ${packageKey}. Expected ${creditPackage.price} cents but Stripe price is ${stripeUnitAmount} cents. Check STRIPE_PRICE_ID_*_CREDITS env vars.`,
        });
      }

      // Ensure user has a Stripe customer ID
      let customerId = user.stripeCustomerId || undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: req.userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(req.userId, { customerId });
      }

      // Create checkout session for one-time payment
      const session = await stripe.checkout.sessions.create({
        mode: 'payment', // One-time payment, not subscription
        customer: customerId,
        line_items: [{ 
          price: creditPackage.priceId, 
          quantity: 1 
        }],
        success_url: `${APP_URL}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/credits`,
        metadata: { 
          userId: req.userId,
          packageKey: packageKey,
          credits: creditPackage.credits.toString(),
          price: creditPackage.price.toString()
        },
      });

      console.log(`💳 Created checkout session for user ${req.userId}: ${packageKey} (${creditPackage.credits} credits)`);

      res.json({ 
        url: session.url,
        sessionId: session.id
      });
    } catch (error: any) {
      console.error('Checkout creation error:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  });

  router.post('/membership-checkout', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        tierKey: z.enum(['CREATOR', 'PRO', 'STUDIO']),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid tier key',
          details: parsed.error.errors,
        });
      }

      const { tierKey } = parsed.data;
      const membership = MEMBERSHIP_TIERS[tierKey];

      console.log(`[MEMBERSHIP] Tier: ${tierKey}, Price ID: ${membership.priceId || 'MISSING'}`);

      if (!membership.priceId) {
        return res.status(500).json({
          error: `Stripe price ID not configured for membership tier ${tierKey}`,
        });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const stripe = getStripe();

      let customerId = user.stripeCustomerId || undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: req.userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(req.userId, { customerId });
      }

      const stripePrice = await stripe.prices.retrieve(membership.priceId);
      const isRecurring = Boolean((stripePrice as any)?.recurring);
      if (!isRecurring) {
        return res.status(500).json({
          error: `Stripe price for ${tierKey} is one-time but membership requires a recurring price. Check STRIPE_PRICE_ID_* membership env vars.`,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{
          price: membership.priceId,
          quantity: 1,
        }],
        success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/buy-credits`,
        metadata: {
          userId: req.userId,
          tierKey,
          tier: membership.tier,
        },
        subscription_data: {
          metadata: {
            userId: req.userId,
            tierKey,
            tier: membership.tier,
          },
        },
      });

      res.json({
        url: session.url,
        sessionId: session.id,
      });
    } catch (error: any) {
      console.error('Membership checkout creation error:', error);
      res.status(500).json({ error: error.message || 'Failed to create membership checkout session' });
    }
  });

  return router;
}
