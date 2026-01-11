import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiting Middleware for CodedSwitch
 * Prevents abuse and controls costs on expensive AI endpoints
 */

/**
 * Helper to safely get client identifier for rate limiting
 * Handles IPv6 addresses properly to prevent bypass attacks
 */
function getClientKey(req: Request): string {
  // Prefer user ID if authenticated
  const userId = (req as any).userId;
  if (userId) return `user:${userId}`;
  
  // Get IP address, handling proxies
  const forwarded = req.headers['x-forwarded-for'];
  let ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.ip || req.socket?.remoteAddress || 'unknown';
  
  // Normalize IPv6 addresses to prevent bypass
  if (ip.includes(':')) {
    // For IPv6, use the /64 prefix to group addresses
    const parts = ip.split(':');
    ip = parts.slice(0, 4).join(':') + '::';
  }
  
  return `ip:${ip}`;
}

// Global rate limiter for all API endpoints
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false }, // Disable IPv6 validation warning
});

// AI Generation rate limiter - EXPENSIVE endpoints (Suno, MusicGen, Grok)
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    // Different limits based on user tier
    const user = (req as any).user;
    if (!user) return 3; // Not logged in: 3 per hour
    
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium':
        return 100; // Premium: 100 per hour
      case 'pro':
        return 30; // Pro: 30 per hour
      case 'free':
      default:
        return 5; // Free: 5 per hour
    }
  },
  message: 'AI generation limit reached. Upgrade your plan for more generations!',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
});

// Lyrics generation rate limiter - MODERATE cost
export const lyricsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 5;
    
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium':
        return 200;
      case 'pro':
        return 50;
      case 'free':
      default:
        return 10;
    }
  },
  message: 'Lyrics generation limit reached. Upgrade for more!',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
});

// Beat/Melody generation rate limiter - MODERATE cost
export const beatGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 10;
    
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium':
        return 500;
      case 'pro':
        return 100;
      case 'free':
      default:
        return 20;
    }
  },
  message: 'Beat generation limit reached. Upgrade for unlimited beats!',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 5;
    
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium':
        return 1000; // Unlimited essentially
      case 'pro':
        return 100;
      case 'free':
      default:
        return 20;
    }
  },
  message: 'Upload limit reached. Upgrade for more uploads!',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
});

// Analysis rate limiter - LOW cost but can be abused
export const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: async (req: Request) => {
    const user = (req as any).user;
    if (!user) return 10;
    
    const tier = user.subscriptionTier || 'free';
    switch (tier) {
      case 'premium':
        return 1000;
      case 'pro':
        return 200;
      case 'free':
      default:
        return 50;
    }
  },
  message: 'Analysis limit reached. Please wait before analyzing more.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { xForwardedForHeader: false },
});
