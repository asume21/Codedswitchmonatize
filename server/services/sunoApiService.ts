// server/services/sunoApiService.ts
// Suno API Integration for AI Music Generation
// API Base: https://api.sunoapi.org
// Documentation: https://docs.sunoapi.org

import fetch from 'node-fetch';

const SUNO_API_BASE = 'https://api.sunoapi.org';

// Model versions available
type SunoModel = 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5';

interface SunoGenerateParams {
  prompt: string;
  style?: string;
  title?: string;
  customMode: boolean;
  instrumental: boolean;
  model?: SunoModel;
  negativeTags?: string;
  vocalGender?: 'm' | 'f';
  callBackUrl?: string;
}

interface SunoApiResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
  };
}

interface SunoTrackData {
  id: string;
  audio_url: string;
  source_audio_url: string;
  stream_audio_url: string;
  source_stream_audio_url: string;
  image_url: string;
  source_image_url: string;
  prompt: string;
  model_name: string;
  title: string;
  tags: string;
  createTime: string;
  duration: number;
}

interface SunoTaskStatusResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
    status: 'pending' | 'text' | 'first' | 'complete' | 'error';
    data?: SunoTrackData[];
    errorMessage?: string;
  };
}

class SunoApiService {
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env.SUNO_API_KEY || null;
  }

  private getApiKey(): string {
    if (!this.apiKey || this.apiKey === 'YOUR_API_KEY') {
      throw new Error('SUNO_API_KEY not configured. Please add your Suno API key to environment variables.');
    }
    return this.apiKey;
  }

  private async makeRequest<T>(endpoint: string, method: string = 'GET', body?: object): Promise<T> {
    const apiKey = this.getApiKey();
    
    const response = await fetch(`${SUNO_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await response.json() as T & { code?: number; msg?: string };
    
    // Check for API-level errors
    if (result.code && result.code !== 200) {
      console.error(`[SunoAPI] API Error ${result.code}:`, result.msg);
      throw new Error(`Suno API error: ${result.code} - ${result.msg}`);
    }

    return result;
  }

  /**
   * Generate music using the official Suno API
   * Endpoint: POST /api/v1/generate
   * Returns 2 songs per request
   */
  async generateMusic(params: SunoGenerateParams): Promise<{ taskId: string }> {
    console.log('[SunoAPI] Generating music:', {
      style: params.style,
      instrumental: params.instrumental,
      model: params.model || 'V4_5ALL',
    });
    
    const requestBody: Record<string, unknown> = {
      customMode: params.customMode,
      instrumental: params.instrumental,
      model: params.model || 'V4_5ALL',
      callBackUrl: params.callBackUrl || '',
    };

    // Custom mode requires style and title
    if (params.customMode) {
      requestBody.style = params.style || 'instrumental';
      requestBody.title = params.title || 'AI Generated Beat';
      if (!params.instrumental) {
        requestBody.prompt = params.prompt;
      }
    } else {
      // Non-custom mode only needs prompt (max 500 chars)
      requestBody.prompt = params.prompt.substring(0, 500);
    }

    if (params.negativeTags) {
      requestBody.negativeTags = params.negativeTags;
    }
    if (params.vocalGender) {
      requestBody.vocalGender = params.vocalGender;
    }

    const result = await this.makeRequest<SunoApiResponse>('/api/v1/generate', 'POST', requestBody);
    
    if (!result.data?.taskId) {
      throw new Error('No taskId returned from Suno API');
    }

    console.log('[SunoAPI] Task created:', result.data.taskId);
    return { taskId: result.data.taskId };
  }

  /**
   * Check the status of a generation task
   * Endpoint: GET /api/v1/generate/record-info?taskId=xxx
   */
  async checkTaskStatus(taskId: string): Promise<SunoTaskStatusResponse['data']> {
    console.log('[SunoAPI] Checking task status:', taskId);
    
    const result = await this.makeRequest<SunoTaskStatusResponse>(
      `/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`
    );
    
    return result.data;
  }

  /**
   * Poll for task completion with streaming URL (available in 30-40 seconds)
   */
  async waitForStreamUrl(taskId: string, maxWaitMs: number = 60000): Promise<SunoTrackData> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkTaskStatus(taskId);
      
      if (!status) {
        throw new Error('Failed to get task status');
      }

      // Check if we have at least one track with a stream URL
      if (status.status === 'first' || status.status === 'complete') {
        if (status.data && status.data.length > 0) {
          const track = status.data[0];
          if (track.stream_audio_url || track.audio_url) {
            console.log('[SunoAPI] Track ready:', track.title);
            return track;
          }
        }
      }
      
      if (status.status === 'error') {
        throw new Error(`Suno generation failed: ${status.errorMessage || 'Unknown error'}`);
      }

      console.log(`[SunoAPI] Task ${taskId} status: ${status.status}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Suno generation timed out waiting for stream URL');
  }

  /**
   * Poll for full completion (downloadable URL ready in 2-3 minutes)
   */
  async waitForCompletion(taskId: string, maxWaitMs: number = 180000): Promise<SunoTrackData[]> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkTaskStatus(taskId);
      
      if (!status) {
        throw new Error('Failed to get task status');
      }

      if (status.status === 'complete') {
        if (status.data && status.data.length > 0) {
          console.log('[SunoAPI] All tracks complete:', status.data.length);
          return status.data;
        }
      }
      
      if (status.status === 'error') {
        throw new Error(`Suno generation failed: ${status.errorMessage || 'Unknown error'}`);
      }

      console.log(`[SunoAPI] Task ${taskId} status: ${status.status}, waiting for completion...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Suno generation timed out');
  }

  /**
   * Generate a beat/instrumental for Astutely
   * Uses custom mode with instrumental=true
   */
  async generateBeat(style: string, bpm?: number, key?: string): Promise<{ audioUrl: string; duration: number; streamUrl: string }> {
    const styleDescription = this.buildStyleDescription(style, bpm, key);
    
    // Use custom mode for instrumentals
    const { taskId } = await this.generateMusic({
      prompt: '', // Not needed for instrumental in custom mode
      style: styleDescription,
      title: `${style} Beat`,
      customMode: true,
      instrumental: true,
      model: 'V4_5ALL', // Best for song structure
      negativeTags: 'vocals, singing, voice',
    });
    
    // Wait for stream URL (faster, available in 30-40 seconds)
    const track = await this.waitForStreamUrl(taskId);
    
    return {
      audioUrl: track.audio_url || track.stream_audio_url,
      streamUrl: track.stream_audio_url || track.audio_url,
      duration: track.duration || 30,
    };
  }

  /**
   * Generate a full song with lyrics
   */
  async generateSong(lyrics: string, style: string, title?: string): Promise<{ audioUrl: string; duration: number; tracks: SunoTrackData[] }> {
    const { taskId } = await this.generateMusic({
      prompt: lyrics,
      style,
      title: title || 'AI Generated Song',
      customMode: true,
      instrumental: false,
      model: 'V4_5PLUS', // Best for vocals
    });
    
    // Wait for full completion
    const tracks = await this.waitForCompletion(taskId);
    
    return {
      audioUrl: tracks[0].audio_url,
      duration: tracks[0].duration,
      tracks,
    };
  }

  /**
   * Quick generation using non-custom mode (simpler, auto-generates lyrics)
   */
  async quickGenerate(prompt: string, instrumental: boolean = true): Promise<{ audioUrl: string; duration: number }> {
    const { taskId } = await this.generateMusic({
      prompt: prompt.substring(0, 500), // Max 500 chars for non-custom mode
      customMode: false,
      instrumental,
      model: 'V4_5ALL',
    });
    
    const track = await this.waitForStreamUrl(taskId);
    
    return {
      audioUrl: track.stream_audio_url || track.audio_url,
      duration: track.duration || 30,
    };
  }

  /**
   * Get remaining API credits
   */
  async getCredits(): Promise<{ credits: number }> {
    const result = await this.makeRequest<{ code: number; data: { credits: number } }>('/api/v1/account/credits');
    return { credits: result.data?.credits || 0 };
  }

  private buildStyleDescription(style: string, bpm?: number, key?: string): string {
    // Style mapping for better Suno prompts
    const stylePrompts: Record<string, string> = {
      'Travis Scott rage': 'dark trap, heavy 808 bass, aggressive synths, rage beat, distorted, hard-hitting',
      'The Weeknd dark': 'dark R&B, synth wave, moody atmosphere, 80s inspired, emotional',
      'Drake smooth': 'smooth trap, melodic 808s, ambient pads, chill vibes, Toronto sound',
      'K-pop cute': 'bright K-pop, energetic synths, catchy melody, upbeat, dance pop',
      'Phonk drift': 'phonk, cowbell, distorted 808s, Memphis style, drift music, aggressive',
      'Future bass': 'future bass, supersaws, energetic EDM, festival, euphoric drops',
      'Lo-fi chill': 'lo-fi hip hop, dusty drums, jazz chords, relaxing, study music, vinyl crackle',
      'Hyperpop glitch': 'hyperpop, glitchy, detuned synths, chaotic, experimental, maximalist',
      'Afrobeats bounce': 'afrobeats, log drums, guitar stabs, bouncy, danceable, African rhythm',
      'Latin trap': 'dembow, reggaeton, Latin trap, perreo, Caribbean vibes',
      'Boom bap': 'boom bap, classic hip hop, vinyl samples, hard drums, 90s style',
      'Drill UK': 'UK drill, sliding 808s, dark melodies, aggressive, London sound',
      'House deep': 'deep house, four on the floor, warm bass, club music, groovy',
      'Synthwave retro': 'synthwave, 80s retro, neon, outrun, nostalgic, electronic',
    };

    let description = stylePrompts[style] || `${style} instrumental`;
    
    if (bpm) {
      description += `, ${bpm} BPM`;
    }
    
    if (key) {
      description += `, ${key}`;
    }

    description += ', professional production, high quality mix';

    return description;
  }

  /**
   * Check if the API is configured and available
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== 'YOUR_API_KEY';
  }

  /**
   * Get API status
   */
  getStatus(): { configured: boolean; apiBase: string; model: string } {
    return {
      configured: this.isConfigured(),
      apiBase: SUNO_API_BASE,
      model: 'V4_5ALL',
    };
  }
}

export const sunoApiService = new SunoApiService();
export default sunoApiService;
