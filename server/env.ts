/**
 * Environment loading — MUST be the first import in server/index.ts.
 *
 * THE BUG THIS FIXES. index.ts began with:
 *
 *     import dotenv from 'dotenv';
 *     dotenv.config();
 *     import { registerRoutes } from './routes';
 *
 * which reads as "load the env, then the app". It is not what happens. This is
 * ESM: every `import` is hoisted and each imported module's body runs to
 * completion BEFORE the first statement of the importing file. So
 * `dotenv.config()` ran *after* the entire server had already initialised.
 *
 * Any service that reads process.env at MODULE scope therefore saw an empty
 * environment. Several do — they construct their singleton on import:
 *
 *     stemSeparation.ts:367   export const stemSeparationService = new StemSeparationService()
 *     aiProviderManager.ts:168 export const aiProviderManager = new AIProviderManager()
 *
 * The result is a server that reports perfectly good credentials as missing:
 * "⚠️ REPLICATE_API_TOKEN not set - Stem separation disabled" while the token
 * sits in .env, valid. Stem separation, cloud RVC and ACE-Step all read that
 * one token; the AI brains have had the same symptom reported against them.
 *
 * It fails SILENTLY and in a way that looks like a configuration mistake, which
 * is why it has been rediscovered more than once.
 *
 * THE FIX. Side-effect import, first in the entry file. Imports are evaluated
 * in order, so this module's body — and therefore dotenv — runs before any
 * other import is even loaded.
 *
 * RULE: never call dotenv.config() anywhere else, and never read process.env at
 * module scope in a service. Read it inside the function that needs it, so a
 * value can never be captured before it exists.
 */

import dotenv from 'dotenv';

dotenv.config();

/** Names a caller can check without hardcoding strings in three places. */
export const REQUIRED_ENV_HINTS = [
  'REPLICATE_API_TOKEN',
  'ELEVENLABS_API_KEY',
  'DATABASE_URL',
] as const;

/**
 * One line at boot saying which credentials actually arrived. Reports presence
 * only — never a value, never a prefix. The point is to make the difference
 * between "missing" and "loaded too late" visible at a glance, because those
 * two look identical from every warning downstream of them.
 */
export function logEnvPresence(): void {
  const present = REQUIRED_ENV_HINTS.filter((k) => (process.env[k] ?? '').trim().length > 0);
  const absent = REQUIRED_ENV_HINTS.filter((k) => (process.env[k] ?? '').trim().length === 0);
  console.log(
    `🔑 env loaded — present: ${present.join(', ') || 'none'}` +
    (absent.length ? ` | absent: ${absent.join(', ')}` : ''),
  );
}
