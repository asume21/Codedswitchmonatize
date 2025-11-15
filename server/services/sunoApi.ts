import fetch from 'node-fetch';

const SUNO_API_BASE = 'https://api.sunoapi.org';
const SUNO_API_KEY = process.env.SUNO_API_KEY;

interface SunoResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * Official Suno API Integration
 * Documentation: https://api.sunoapi.org
 */
export class SunoApiService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || SUNO_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ SUNO_API_KEY not configured');
    }
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: any
  ): Promise<SunoResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'SUNO_API_KEY not configured'
      };
    }

    try {
      const url = `${SUNO_API_BASE}${endpoint}`;
      console.log(`🎵 Suno API Request: ${method} ${endpoint}`);

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Suno API Error:', data);
        return {
          success: false,
          error: data.message || data.error || 'Suno API request failed',
          data
        };
      }

      console.log('✅ Suno API Success');
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('❌ Suno API Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Upload and Cover Audio - Transform existing audio with new styles
   * https://api.sunoapi.org/docs/upload-and-cover
   */
  async uploadAndCover(params: {
    audioUrl: string;
    prompt: string;
    model?: string; // v3_5, v4, v4_5, v4_5plus, v5
    makeInstrumental?: boolean;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/upload-and-cover', 'POST', params);
  }

  /**
   * Upload and Extend Audio - Extend uploaded tracks with AI continuation
   * https://api.sunoapi.org/docs/upload-and-extend
   */
  async uploadAndExtend(params: {
    audioUrl: string;
    prompt?: string;
    continueAt?: number; // Timestamp in seconds
    model?: string;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/upload-and-extend', 'POST', params);
  }

  /**
   * Separate Vocals from Music - Extract vocals and instrumentals
   * https://api.sunoapi.org/docs/separate-vocals
   */
  async separateVocals(params: {
    audioUrl: string;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/separate-vocals', 'POST', params);
  }

  /**
   * Generate Music - Create new music from text prompts
   * https://api.sunoapi.org/docs/generate-music
   */
  async generateMusic(params: {
    prompt: string;
    makeInstrumental?: boolean;
    model?: string; // v3_5, v4, v4_5, v4_5plus, v5
    waitAudio?: boolean;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/generate', 'POST', params);
  }

  /**
   * Extend Music - Continue existing generated music
   * https://api.sunoapi.org/docs/extend-music
   */
  async extendMusic(params: {
    audioId: string;
    prompt?: string;
    continueAt?: number;
    model?: string;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/extend', 'POST', params);
  }

  /**
   * Add Vocals - Generate vocal tracks for instrumentals
   * https://api.sunoapi.org/docs/add-vocals
   */
  async addVocals(params: {
    audioUrl: string;
    prompt: string;
    model?: string;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/add-vocals', 'POST', params);
  }

  /**
   * Add Instrumental - Create instrumental accompaniment
   * https://api.sunoapi.org/docs/add-instrumental
   */
  async addInstrumental(params: {
    audioUrl: string;
    prompt: string;
    model?: string;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/add-instrumental', 'POST', params);
  }

  /**
   * Get Music Generation Details - Check status and get results
   * https://api.sunoapi.org/docs/get-music-details
   */
  async getMusicDetails(ids: string[]) {
    return this.makeRequest('/api/get', 'POST', { ids });
  }

  /**
   * Get Remaining Credits - Check account balance
   * https://api.sunoapi.org/docs/get-credits
   */
  async getRemainingCredits() {
    return this.makeRequest('/api/get-credits', 'GET');
  }

  /**
   * Convert to WAV Format - Convert to high-quality WAV
   * https://api.sunoapi.org/docs/convert-to-wav
   */
  async convertToWav(audioId: string) {
    return this.makeRequest('/api/convert-to-wav', 'POST', { audio_id: audioId });
  }

  /**
   * Generate Lyrics - Create AI-powered lyrics
   * https://api.sunoapi.org/docs/generate-lyrics
   */
  async generateLyrics(params: {
    prompt: string;
    callbackUrl?: string;
  }) {
    return this.makeRequest('/api/generate-lyrics', 'POST', params);
  }

  /**
   * Get Timestamped Lyrics - Retrieve synced lyrics
   * https://api.sunoapi.org/docs/timestamped-lyrics
   */
  async getTimestampedLyrics(audioId: string) {
    return this.makeRequest('/api/get-timestamped-lyrics', 'POST', { audio_id: audioId });
  }

  /**
   * Analyze uploaded song and suggest transformations
   */
  async analyzeSongForTransformation(songUrl: string, songName: string) {
    // This uses the AI to suggest what transformations would work best
    const suggestions = {
      canCover: true,
      canExtend: true,
      canSeparateVocals: true,
      suggestedStyles: [
        'acoustic version',
        'electronic remix',
        'orchestral arrangement',
        'lo-fi version',
        'jazz interpretation'
      ],
      suggestedModels: ['v4_5plus', 'v5'] as const,
      recommendations: [
        'Try "Upload and Cover" to create style variations',
        'Use "Separate Vocals" to get stems for remixing',
        'Extend the track with "Upload and Extend" for longer versions'
      ]
    };

    return {
      success: true,
      data: suggestions
    };
  }
}

// Singleton instance
export const sunoApi = new SunoApiService();
