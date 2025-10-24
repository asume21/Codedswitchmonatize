// Feature tier definitions for CodedSwitch

export type UserTier = 'free' | 'pro' | 'owner';

export interface TierLimits {
  // Song Uploader
  maxSongUploads: number; // per month
  maxSongSize: number; // in MB
  
  // AI Features
  maxMelodyGenerations: number; // per month
  maxBeatGenerations: number; // per month
  maxPackGenerations: number; // per month
  maxCodeTranslations: number; // per month
  
  // Studio Features
  maxProjectSaves: number;
  enableAdvancedSequencer: boolean;
  enableGranularEngine: boolean;
  
  // Analysis Features
  enableSongAnalysis: boolean;
  enableVulnerabilityScanning: boolean;
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    // Free tier - limited but usable
    maxSongUploads: 3,
    maxSongSize: 10, // 10MB
    maxMelodyGenerations: 5,
    maxBeatGenerations: 5,
    maxPackGenerations: 3,
    maxCodeTranslations: 10,
    maxProjectSaves: 3,
    enableAdvancedSequencer: false,
    enableGranularEngine: false,
    enableSongAnalysis: false,
    enableVulnerabilityScanning: false,
  },
  pro: {
    // Pro tier - full access
    maxSongUploads: 100,
    maxSongSize: 50, // 50MB
    maxMelodyGenerations: 500,
    maxBeatGenerations: 500,
    maxPackGenerations: 100,
    maxCodeTranslations: 1000,
    maxProjectSaves: 999,
    enableAdvancedSequencer: true,
    enableGranularEngine: true,
    enableSongAnalysis: true,
    enableVulnerabilityScanning: true,
  },
  owner: {
    // Owner tier - unlimited everything
    maxSongUploads: 999999,
    maxSongSize: 500, // 500MB
    maxMelodyGenerations: 999999,
    maxBeatGenerations: 999999,
    maxPackGenerations: 999999,
    maxCodeTranslations: 999999,
    maxProjectSaves: 999999,
    enableAdvancedSequencer: true,
    enableGranularEngine: true,
    enableSongAnalysis: true,
    enableVulnerabilityScanning: true,
  },
};

// Helper function to get tier limits for a user
export function getTierLimits(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier];
}

// Check if user has access to a feature
export function hasFeatureAccess(tier: UserTier, feature: keyof TierLimits): boolean {
  const limits = TIER_LIMITS[tier];
  const value = limits[feature];
  return typeof value === 'boolean' ? value : value > 0;
}
