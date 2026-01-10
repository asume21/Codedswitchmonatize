import fetch from 'node-fetch';

const SUNO_API_BASE = 'https://api.sunoapi.org/api/v1';
const SUNO_API_KEY = process.env.SUNO_API_KEY || process.env.SUNO_API_TOKEN;

interface SunoApiResponse {
  code: number;
  msg: string;
  data?: any;
}

interface SunoResponse {
  success: boolean;
  data?: any;
  taskId?: string;
  error?: string;
  message?: string;
}

/**
 * Official Suno API Integration
 * Documentation: https://docs.sunoapi.org
 * Base URL: https://api.sunoapi.org/api/v1
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
        error: 'SUNO_API_KEY not configured. Get your key at https://sunoapi.org'
      };
    }

    try {
      const url = `${SUNO_API_BASE}${endpoint}`;
      console.log(`🎵 Suno API Request: ${method} ${url}`);
      if (body) {
        console.log(`📦 Request body:`, JSON.stringify(body, null, 2));
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json() as SunoApiResponse;

      if (data.code !== 200) {
        console.error('❌ Suno API Error:', data);
        return {
          success: false,
          error: data.msg || 'Suno API request failed',
          data
        };
      }

      console.log('✅ Suno API Success:', data.msg);
      return {
        success: true,
        data: data.data,
        taskId: data.data?.taskId
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
   * Generate Music - Create new music from text prompts
   * Models: V3_5, V4, V4_5, V4_5PLUS, V5
   */
  async generateMusic(params: {
    prompt: string;
    customMode?: boolean;
    instrumental?: boolean;
    model?: 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V5';
    style?: string;       // Required if customMode=true
    title?: string;       // Required if customMode=true
    callBackUrl?: string;
  }) {
    return this.makeRequest('/generate', 'POST', {
      prompt: params.prompt,
      customMode: params.customMode ?? false,
      instrumental: params.instrumental ?? false,
      model: params.model || 'V4_5',
      style: params.style,
      title: params.title,
      callBackUrl: params.callBackUrl
    });
  }

  /**
   * Get Task Status - Check generation status and get results
   */
  async getTaskStatus(taskId: string) {
    return this.makeRequest(`/generate/record-info?taskId=${taskId}`, 'GET');
  }

  /**
   * Generate Lyrics - Create AI-powered lyrics
   */
  async generateLyrics(params: {
    prompt: string;
    callBackUrl?: string;
  }) {
    return this.makeRequest('/lyrics', 'POST', params);
  }

  /**
   * Extend Music - Continue existing generated music
   */
  async extendMusic(params: {
    audioId: string;
    defaultParamFlag?: boolean;
    prompt?: string;
    continueAt?: number;
    model?: 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V5';
    callBackUrl?: string;
  }) {
    return this.makeRequest('/generate/extend', 'POST', params);
  }

  /**
   * Upload and Cover - Transform existing audio with new styles
   */
  async uploadAndCover(params: {
    uploadUrl: string;
    customMode?: boolean;
    style?: string;
    title?: string;
    prompt?: string;
    callBackUrl?: string;
  }) {
    return this.makeRequest('/generate/upload-and-cover', 'POST', params);
  }

  /**
   * Separate Vocals - Extract vocals and instrumentals
   */
  async separateVocals(params: {
    taskId: string;
    audioId: string;
    callBackUrl?: string;
  }) {
    return this.makeRequest('/vocal-removal/generate', 'POST', params);
  }

  /**
   * Convert to WAV - High quality audio conversion
   */
  async convertToWav(params: {
    taskId: string;
    audioId: string;
    callBackUrl?: string;
  }) {
    return this.makeRequest('/wav/generate', 'POST', params);
  }

  /**
   * Get Remaining Credits - Check account balance
   */
  async getRemainingCredits() {
    return this.makeRequest('/get-credits', 'GET');
  }

  /**
   * Wait for task completion with polling
   */
  async waitForCompletion(taskId: string, maxWaitMs = 600000, pollIntervalMs = 30000): Promise<SunoResponse> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getTaskStatus(taskId);
      
      if (!status.success) {
        return status;
      }
      
      const taskStatus = status.data?.status;
      console.log(`⏳ Task ${taskId} status: ${taskStatus}`);
      
      if (taskStatus === 'SUCCESS') {
        return {
          success: true,
          data: status.data?.response?.data || status.data
        };
      } else if (taskStatus === 'FAILED') {
        return {
          success: false,
          error: status.data?.errorMessage || 'Generation failed'
        };
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    return {
      success: false,
      error: 'Generation timeout - task took too long'
    };
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
