import crypto from 'crypto';

/**
 * Generates a secure activation key
 * Format: TIER-XXXXXXXX-XXXXXXXX-XXXXXXXX (e.g., PRO-A1B2C3D4-E5F6G7H8-I9J0K1L2)
 */
export function generateActivationKey(tier: 'owner' | 'pro' | 'basic' | 'trial' = 'pro'): string {
  // Generate 3 random 8-character segments
  const segments = Array(3).fill(0).map(() => {
    return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
  });
  
  return `${tier.toUpperCase()}-${segments.join('-')}`;
}

/**
 * Validates the format of an activation key
 */
export function validateKeyFormat(key: string): { valid: boolean; tier?: string } {
  const keyRegex = /^(OWNER|PRO|BASIC|TRIAL)-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/i;
  const match = key.match(keyRegex);
  
  if (!match) {
    return { valid: false };
  }
  
  return { 
    valid: true, 
    tier: match[1].toLowerCase() 
  };
}

/**
 * Generate multiple keys at once
 */
export function generateActivationKeys(count: number, tier: 'owner' | 'pro' | 'basic' | 'trial' = 'pro'): string[] {
  return Array(count).fill(0).map(() => generateActivationKey(tier));
}

/**
 * Example usage for CLI or admin panel
 */
export function generateKeyBatch(tier: string, count: number = 10) {
  const validTiers = ['owner', 'pro', 'basic', 'trial'];
  if (!validTiers.includes(tier.toLowerCase())) {
    throw new Error(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
  }
  
  const keys = generateActivationKeys(count, tier as any);
  
  return {
    tier: tier.toUpperCase(),
    count,
    generatedAt: new Date().toISOString(),
    keys,
    // Format for easy sharing/storage
    csv: keys.join('\n'),
    json: JSON.stringify({ tier: tier.toUpperCase(), keys }, null, 2)
  };
}
