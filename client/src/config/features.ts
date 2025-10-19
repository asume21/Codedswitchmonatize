/**
 * Feature Flags Configuration
 * Control which v2 components are enabled
 */

export const FEATURES = {
  // Global v2 toggle - master switch for all new design
  useV2Design: import.meta.env.VITE_USE_V2_DESIGN === 'true',
  
  // Component-specific toggles
  useNewHero: import.meta.env.VITE_USE_NEW_HERO === 'true',
  useNewNavigation: import.meta.env.VITE_USE_NEW_NAVIGATION === 'true',
  useNewStudioDashboard: import.meta.env.VITE_USE_NEW_STUDIO_DASHBOARD === 'true',
  useNewPianoRoll: import.meta.env.VITE_USE_NEW_PIANO_ROLL === 'true',
  useNewBeatMaker: import.meta.env.VITE_USE_NEW_BEAT_MAKER === 'true',
  useNewAICopilot: import.meta.env.VITE_USE_NEW_AI_COPILOT === 'true',
  useNewSocialHub: import.meta.env.VITE_USE_NEW_SOCIAL_HUB === 'true',
  
  // Feature flags for new functionality
  enableParticleEffects: import.meta.env.VITE_ENABLE_PARTICLE_EFFECTS === 'true',
  enableAudioReactive: import.meta.env.VITE_ENABLE_AUDIO_REACTIVE === 'true',
  enableSoundEffects: import.meta.env.VITE_ENABLE_SOUND_EFFECTS === 'true',
  enableGlassmorphism: import.meta.env.VITE_ENABLE_GLASSMORPHISM === 'true',
} as const;

/**
 * Check if any v2 feature is enabled
 */
export function isV2Enabled(): boolean {
  return FEATURES.useV2Design || 
         FEATURES.useNewHero || 
         FEATURES.useNewNavigation ||
         FEATURES.useNewStudioDashboard ||
         FEATURES.useNewPianoRoll ||
         FEATURES.useNewBeatMaker ||
         FEATURES.useNewAICopilot ||
         FEATURES.useNewSocialHub;
}

/**
 * Get feature flag status for debugging
 */
export function getFeatureStatus() {
  return {
    ...FEATURES,
    anyV2Enabled: isV2Enabled(),
  };
}

// Log feature status in development
if (import.meta.env.DEV) {
  console.log('🎨 Feature Flags:', getFeatureStatus());
}
