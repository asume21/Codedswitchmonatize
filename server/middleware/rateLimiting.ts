import rateLimit, { type Options, ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Rate Limiting Middleware for CodedSwitch
 * Prevents abuse and controls costs on expensive AI endpoints.
 *
 * IMPORTANT: Every limiter uses a custom `handler` that guarantees a JSON
 * response with proper 429 status + Retry-After header.  The default
 * express-rate-limit behaviour sends text/html when `message` is a string,
 * which causes the frontend to crash with "Server returned HTML instead of JSON".
 */

// ── helpers ──────────────────────────────────────────────────────────────────

/** Safely resolve a client key: authenticated user id, or normalised IP. */
function getClientKey(req: Request): string {
  const userId = (req as any).userId;
  if (userId) return `user:${userId}`;

  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || 'unknown';

  return `ip:${ipKeyGenerator(ip, 64)}`;
}

/**
 * Custom handler that ALWAYS returns JSON with rate-limit metadata.
 * express-rate-limit calls this instead of the default handler.
 */
function jsonRateLimitHandler(
  userMessage: string,
): Options['handler'] {
  return (req: Request, res: Response) => {
    const retryAfter = res.getHeader('Retry-After');
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: userMessage,
      retryAfter: retryAfter ? Number(retryAfter) : undefined,
    });
  };
}

/** Shared defaults that every limiter inherits. */
const SHARED: Partial<Options> = {
  standardHeaders: true,   // Send RateLimit-* headers
  legacyHeaders: false,     // Disable X-RateLimit-* headers
  keyGenerator: getClientKey,
  skipFailedRequests: true,
  validate: { xForwardedForHeader: false },
};

// ── limiters ─────────────────────────────────────────────────────────────────

/** Global: 200 req / 15 min per client (all /api/* routes). */
export const globalLimiter = rateLimit({
  ...SHARED,
  windowMs: 15 * 60 * 1000,
  max: 200,
  handler: jsonRateLimitHandler(
    'Too many requests. Please slow down and try again shortly.',
  ),
});

/** AI Generation: tier-based limits per hour (Suno, MusicGen, Grok, etc.). */
export const aiGenerationLimiter = rateLimit({
  ...SHARED,
  windowMs: 60 * 60 * 1000,
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 3;
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium': return 100;
      case 'pro':     return 30;
      default:        return 5;
    }
  },
  handler: jsonRateLimitHandler(
    'AI generation limit reached. Upgrade your plan for more generations.',
  ),
});

/** Lyrics generation: moderate cost. */
export const lyricsLimiter = rateLimit({
  ...SHARED,
  windowMs: 60 * 60 * 1000,
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 5;
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium': return 200;
      case 'pro':     return 50;
      default:        return 10;
    }
  },
  handler: jsonRateLimitHandler(
    'Lyrics generation limit reached. Upgrade for more.',
  ),
});

/** Beat / melody generation: moderate cost. */
export const beatGenerationLimiter = rateLimit({
  ...SHARED,
  windowMs: 60 * 60 * 1000,
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 10;
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium': return 500;
      case 'pro':     return 100;
      default:        return 20;
    }
  },
  handler: jsonRateLimitHandler(
    'Beat generation limit reached. Upgrade for unlimited beats.',
  ),
});

/** File uploads. */
export const uploadLimiter = rateLimit({
  ...SHARED,
  windowMs: 60 * 60 * 1000,
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 5;
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium': return 1000;
      case 'pro':     return 100;
      default:        return 20;
    }
  },
  handler: jsonRateLimitHandler(
    'Upload limit reached. Upgrade for more uploads.',
  ),
});

/** Analysis endpoints: low cost but abusable. */
export const analysisLimiter = rateLimit({
  ...SHARED,
  windowMs: 15 * 60 * 1000,
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 10;
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium': return 1000;
      case 'pro':     return 200;
      default:        return 50;
    }
  },
  handler: jsonRateLimitHandler(
    'Analysis limit reached. Please wait before analysing more.',
  ),
});
