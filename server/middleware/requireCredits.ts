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
