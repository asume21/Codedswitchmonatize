// server/services/sunoApiService.ts
// Suno API Integration for AI Music Generation
// API Base: https://api.sunoapi.org

import fetch from 'node-fetch';

const SUNO_API_BASE = 'https://api.sunoapi.org';

interface SunoGenerateParams {
  prompt: string;
  style?: string;
  title?: string;
  make_instrumental?: boolean;
  wait_audio?: boolean;
}

interface SunoGenerateResponse {
  id: string;
  status: string;
  audio_url?: string;
  video_url?: string;
  title?: string;
  duration?: number;
  created_at?: string;
  model_name?: string;
  error?: string;
}

interface SunoTaskResponse {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  audio_url?: string;
  video_url?: string;
  title?: string;
  duration?: number;
  error?: string;
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SunoAPI] Error ${response.status}:`, errorText);
      throw new Error(`Suno API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Generate music with custom lyrics/prompt
   */
  async generateMusic(params: SunoGenerateParams): Promise<SunoGenerateResponse> {
    console.log('[SunoAPI] Generating music with prompt:', params.prompt?.substring(0, 50) + '...');
    
    const result = await this.makeRequest<SunoGenerateResponse>('/api/v1/generate', 'POST', {
      prompt: params.prompt,
      style: params.style || 'pop',
      title: params.title || 'AI Generated Track',
      make_instrumental: params.make_instrumental ?? false,
      wait_audio: params.wait_audio ?? true, // Wait for audio to be ready
    });

    console.log('[SunoAPI] Generation result:', { id: result.id, status: result.status });
    return result;
  }

  /**
   * Generate instrumental music (no vocals)
   */
  async generateInstrumental(prompt: string, style?: string): Promise<SunoGenerateResponse> {
    return this.generateMusic({
      prompt,
      style,
      make_instrumental: true,
      wait_audio: true,
    });
  }

  /**
   * Generate a full song with lyrics
   */
  async generateSong(lyrics: string, style: string, title?: string): Promise<SunoGenerateResponse> {
    return this.generateMusic({
      prompt: lyrics,
      style,
      title,
      make_instrumental: false,
      wait_audio: true,
    });
  }

  /**
   * Check the status of a generation task
   */
  async checkTaskStatus(taskId: string): Promise<SunoTaskResponse> {
    console.log('[SunoAPI] Checking task status:', taskId);
    return this.makeRequest<SunoTaskResponse>(`/api/v1/task/${taskId}`);
  }

  /**
   * Poll for task completion
   */
  async waitForCompletion(taskId: string, maxWaitMs: number = 120000): Promise<SunoTaskResponse> {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkTaskStatus(taskId);
      
      if (status.status === 'complete') {
        console.log('[SunoAPI] Task completed:', taskId);
        return status;
      }
      
      if (status.status === 'error') {
        throw new Error(`Suno generation failed: ${status.error || 'Unknown error'}`);
      }

      console.log(`[SunoAPI] Task ${taskId} status: ${status.status}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Suno generation timed out');
  }

  /**
   * Generate a beat/instrumental for Astutely
   */
  async generateBeat(style: string, bpm?: number, key?: string): Promise<{ audioUrl: string; duration: number }> {
    const prompt = this.buildBeatPrompt(style, bpm, key);
    
    const result = await this.generateInstrumental(prompt, style);
    
    if (!result.audio_url) {
      // If not immediately ready, poll for completion
      if (result.id) {
        const completed = await this.waitForCompletion(result.id);
        if (completed.audio_url) {
          return {
            audioUrl: completed.audio_url,
            duration: completed.duration || 30,
          };
        }
      }
      throw new Error('Failed to generate beat - no audio URL returned');
    }

    return {
      audioUrl: result.audio_url,
      duration: result.duration || 30,
    };
  }

  private buildBeatPrompt(style: string, bpm?: number, key?: string): string {
    const parts: string[] = [];
    
    // Style mapping for better prompts
    const stylePrompts: Record<string, string> = {
      'Travis Scott rage': 'dark trap beat, heavy 808s, aggressive synths, rage style',
      'The Weeknd dark': 'dark R&B instrumental, synth wave, moody atmosphere',
      'Drake smooth': 'smooth trap beat, melodic 808s, ambient pads',
      'K-pop cute': 'bright K-pop instrumental, energetic synths, catchy melody',
      'Phonk drift': 'phonk beat, cowbell, distorted 808s, Memphis style',
      'Future bass': 'future bass drop, supersaws, energetic EDM',
      'Lo-fi chill': 'lo-fi hip hop beat, dusty drums, jazz chords, relaxing',
      'Hyperpop glitch': 'hyperpop instrumental, glitchy, detuned synths, chaotic',
      'Afrobeats bounce': 'afrobeats instrumental, log drums, guitar stabs, bouncy',
      'Latin trap': 'dembow beat, reggaeton style, Latin trap instrumental',
    };

    parts.push(stylePrompts[style] || `${style} instrumental beat`);
    
    if (bpm) {
      parts.push(`${bpm} BPM`);
    }
    
    if (key) {
      parts.push(`key of ${key}`);
    }

    parts.push('high quality production, professional mix');

    return parts.join(', ');
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
  getStatus(): { configured: boolean; apiBase: string } {
    return {
      configured: this.isConfigured(),
      apiBase: SUNO_API_BASE,
    };
  }
}

export const sunoApiService = new SunoApiService();
export default sunoApiService;
