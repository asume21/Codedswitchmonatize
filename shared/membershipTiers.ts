/**
 * Membership tiers — the ONE source for what each plan costs and grants.
 *
 * Imported by the server (credit grants, checkout) and the pricing page, so the
 * numbers a customer reads are the numbers the webhook grants. Before this
 * module the page and server kept separate tables that drifted (page promised
 * 200/750 credits, server granted 300/1000 — product review F2, 2026-10-07).
 *
 * Features list only what the app actually delivers to a paid account
 * (`/api/check-license` → isPro for any active subscription). Everyone,
 * including free users, already owns commercial rights to their output
 * (see terms), so that is deliberately not sold as a paid perk.
 */

export interface MembershipTierInfo {
  tier: 'free' | 'creator' | 'pro' | 'studio';
  name: string;
  /** Monthly price in cents. */
  price: number;
  monthlyCredits: number;
  features: readonly string[];
  badge?: string;
}

const PAID_FEATURES = [
  'Unused credits roll over',
  'Export WAV, MIDI and stems',
  'AI chord progressions',
] as const;

export const MEMBERSHIP_TIER_INFO = {
  FREE: {
    tier: 'free',
    name: 'Free',
    price: 0,
    monthlyCredits: 0,
    features: ['10 credits to start', 'Save projects to your account', 'The Organism live band'],
  },
  CREATOR: {
    tier: 'creator',
    name: 'Creator',
    price: 999,
    monthlyCredits: 300,
    features: ['300 credits every month', ...PAID_FEATURES],
  },
  PRO: {
    tier: 'pro',
    name: 'Pro',
    price: 2999,
    monthlyCredits: 1000,
    features: ['1000 credits every month', ...PAID_FEATURES],
    badge: 'Most Popular',
  },
  STUDIO: {
    tier: 'studio',
    name: 'Studio',
    price: 7999,
    monthlyCredits: 2500,
    features: ['2500 credits every month', ...PAID_FEATURES],
    badge: 'Best Value',
  },
} as const satisfies Record<string, MembershipTierInfo>;

export type MembershipTierKey = keyof typeof MEMBERSHIP_TIER_INFO;
