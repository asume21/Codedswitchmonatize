/**
 * AI Provider Manager
 * Allows users to select which AI service to use for music generation
 */

export type AIProvider = 'replicate-suno' | 'replicate-musicgen' | 'openai' | 'grok' | 'local';

export interface AIProviderConfig {
  name: string;
  label: string;
  description: string;
  capabilities: {
    fullSongs: boolean;
    beats: boolean;
    instrumentals: boolean;
    lyrics: boolean;
    analysis: boolean;
  };
  requiresAuth: boolean;
  envVar?: string;
}

export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  'replicate-suno': {
    name: 'replicate-suno',
    label: 'Suno (via Replicate)',
    description: 'Professional full-song generation with vocals',
    capabilities: {
      fullSongs: true,
      beats: false,
      instrumentals: false,
      lyrics: false,
      analysis: false
    },
    requiresAuth: true,
    envVar: 'REPLICATE_API_TOKEN'
  },
  'replicate-musicgen': {
    name: 'replicate-musicgen',
    label: 'MusicGen (via Replicate)',
    description: 'Beats, melodies, and instrumental generation',
    capabilities: {
      fullSongs: false,
      beats: true,
      instrumentals: true,
      lyrics: false,
      analysis: false
    },
    requiresAuth: true,
    envVar: 'REPLICATE_API_TOKEN'
  },
  'grok': {
    name: 'grok',
    label: 'Grok (XAI)',
    description: 'Lyrics generation and analysis',
    capabilities: {
      fullSongs: false,
      beats: false,
      instrumentals: false,
      lyrics: true,
      analysis: true
    },
    requiresAuth: true,
    envVar: 'XAI_API_KEY'
  },
  'openai': {
    name: 'openai',
    label: 'OpenAI',
    description: 'Code translation and text analysis',
    capabilities: {
      fullSongs: false,
      beats: false,
      instrumentals: false,
      lyrics: false,
      analysis: true
    },
    requiresAuth: true,
    envVar: 'OPENAI_API_KEY'
  },
  'local': {
    name: 'local',
    label: 'Local Processing',
    description: 'Basic analysis without external API',
    capabilities: {
      fullSongs: false,
      beats: false,
      instrumentals: false,
      lyrics: false,
      analysis: true
    },
    requiresAuth: false
  }
};

export class AIProviderManager {
  private selectedProviders: Map<string, AIProvider> = new Map();

  /**
   * Set the AI provider for a specific feature
   */
  setProvider(feature: string, provider: AIProvider): void {
    this.selectedProviders.set(feature, provider);
  }

  /**
   * Get the AI provider for a specific feature
   */
  getProvider(feature: string): AIProvider {
    return this.selectedProviders.get(feature) || 'replicate-musicgen';
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): AIProviderConfig[] {
    return Object.values(AI_PROVIDERS);
  }

  /**
   * Get providers that support a specific capability
   */
  getProvidersForCapability(capability: keyof AIProviderConfig['capabilities']): AIProviderConfig[] {
    return Object.values(AI_PROVIDERS).filter(
      provider => provider.capabilities[capability]
    );
  }

  /**
   * Validate if a provider supports a capability
   */
  supportsCapability(provider: AIProvider, capability: keyof AIProviderConfig['capabilities']): boolean {
    return AI_PROVIDERS[provider]?.capabilities[capability] || false;
  }

  /**
   * Check if provider is authenticated
   */
  isAuthenticated(provider: AIProvider): boolean {
    const config = AI_PROVIDERS[provider];
    if (!config.requiresAuth) return true;
    if (!config.envVar) return false;
    return !!process.env[config.envVar];
  }

  /**
   * Get all authenticated providers
   */
  getAuthenticatedProviders(): AIProviderConfig[] {
    return Object.entries(AI_PROVIDERS)
      .filter(([key]) => this.isAuthenticated(key as AIProvider))
      .map(([, config]) => config);
  }
}

export const aiProviderManager = new AIProviderManager();
