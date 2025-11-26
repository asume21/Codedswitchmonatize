/**
 * Credit Requirement Middleware
 * Checks if user has sufficient credits before allowing API access
 */

import type { Request, Response, NextFunction } from 'express';
import { getCreditService } from '../services/credits';
import type { IStorage } from '../storage';

/**
 * Middleware factory to require a specific amount of credits
 * Usage: router.post('/api/endpoint', requireCredits(5), handler)
 */
export function requireCredits(cost: number, storage: IStorage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please log in to use this feature',
        });
      }

      const creditService = getCreditService(storage);

      // Check for owner bypass
      let isOwner = req.isOwner || false;
      
      // Check 1: x-owner-key bypass (sets userId to 'owner-user')
      if (req.userId === 'owner-user') {
        isOwner = true;
      } 
      // Check 2: Email match with OWNER_EMAIL env var
      else if (process.env.OWNER_EMAIL) {
        try {
          const user = await storage.getUser(req.userId);
          const ownerEmail = process.env.OWNER_EMAIL.toLowerCase();
          if (user?.email && user.email.toLowerCase() === ownerEmail) {
            isOwner = true;
            console.log(`👑 Owner authenticated: ${user.email}`);
          }
        } catch (e) {
          console.warn('Failed to check owner status:', e);
        }
      }

      // If owner, allow operation without checking credits but still populate credit service
      if (isOwner) {
        req.isOwner = true;
        req.creditCost = 0; // No cost for owner
        req.creditService = creditService;
        req.creditInfinite = true; // Explicit flag to denote unlimited credits
        return next();
      }

      // Check if user has enough credits
      const hasEnoughCredits = await creditService.hasCredits(req.userId, cost);

      if (!hasEnoughCredits) {
        const currentBalance = await creditService.getBalance(req.userId);
        
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `This operation requires ${cost} credits. You have ${currentBalance} credits.`,
          required: cost,
          current: currentBalance,
          deficit: cost - currentBalance,
          purchaseUrl: '/pricing',
        });
      }

      // Store credit cost in request for later deduction
      req.creditCost = cost;
      req.creditService = creditService;

      next();
    } catch (error) {
      console.error('Credit check error:', error);
      res.status(500).json({
        error: 'Credit check failed',
        message: 'Unable to verify credit balance',
      });
    }
  };
}

/**
 * Middleware to deduct credits after successful operation
 * Should be called AFTER the operation succeeds
 * Usage: Call manually in success handler or use deductCreditsOnSuccess middleware
 */
export async function deductCredits(
  req: Request,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  // Skip if cost is 0 or owner has infinite credits
  if (req.creditCost === 0 || (req as any).creditInfinite) {
    return;
  }

  if (!req.userId || !req.creditCost || !req.creditService) {
    console.warn('⚠️ Attempted to deduct credits without proper setup');
    return;
  }

  try {
    await req.creditService.deductCredits(
      req.userId,
      req.creditCost,
      reason,
      metadata
    );
  } catch (error) {
    console.error('❌ Failed to deduct credits:', error);
    // Don't throw - operation already succeeded, just log the error
  }
}

/**
 * Extended Request type with credit properties
 */
declare global {
  namespace Express {
    interface Request {
      creditCost?: number;
      creditService?: ReturnType<typeof getCreditService>;
    }
  }
}
