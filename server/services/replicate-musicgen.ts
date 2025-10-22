import fetch from 'node-fetch';

/**
 * Replicate MusicGen Service - Real AI Audio Generation
 * Uses Replicate's hosted MusicGen model for actual audio synthesis
 */
export class ReplicateMusicGenService {
  private apiToken: string;
  private apiUrl = 'https://api.replicate.com/v1';

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('⚠️ REPLICATE_API_TOKEN not set - MusicGen will not work');
    }
  }

  /**
   * Generate music using Replicate's MusicGen model
   */
  async generateMusic(prompt: string, duration: number = 10): Promise<string | null> {
    if (!this.apiToken) {
      console.error('❌ Replicate API token not configured');
      return null;
    }

    try {
      console.log(`🎵 Generating music with Replicate: "${prompt}" (${duration}s)`);

      // Create prediction
      const predictionResponse = await fetch(`${this.apiUrl}/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '7a76a8258b23fae65c5a22debb8841d1d7e816b75c2f24218cd2bd85737879072',
          input: {
            prompt: prompt,
            duration: Math.min(duration, 30), // Max 30 seconds
            temperature: 1.0,
            top_k: 250,
            top_p: 0.0,
          },
        }),
      });

      if (!predictionResponse.ok) {
        const error = await predictionResponse.text();
        console.error('❌ Replicate API error:', error);
        return null;
      }

      const prediction = await predictionResponse.json() as any;
      const predictionId = prediction.id;

      console.log(`⏳ Waiting for generation (prediction ID: ${predictionId})`);

      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes max

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const statusResponse = await fetch(`${this.apiUrl}/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Token ${this.apiToken}`,
          },
        });

        if (!statusResponse.ok) {
          console.error('❌ Failed to check prediction status');
          return null;
        }

        const status = await statusResponse.json() as any;

        if (status.status === 'succeeded') {
          console.log(`✅ Music generated successfully`);
          return status.output?.[0] || null;
        } else if (status.status === 'failed') {
          console.error('❌ Generation failed:', status.error);
          return null;
        }

        attempts++;
      }

      console.error('❌ Generation timeout');
      return null;

    } catch (error) {
      console.error('❌ Replicate MusicGen error:', error);
      return null;
    }
  }

  /**
   * Generate multiple music variations
   */
  async generateMusicBatch(prompt: string, count: number = 4, duration: number = 10): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < count; i++) {
      try {
        // Add variation to each prompt
        const variations = [
          prompt,
          `${prompt} with more energy`,
          `${prompt} ambient version`,
          `${prompt} upbeat remix`
        ];

        const variedPrompt = variations[i % variations.length];
        const audioUrl = await this.generateMusic(variedPrompt, duration);

        if (audioUrl) {
          results.push(audioUrl);
        }
      } catch (error) {
        console.error(`❌ Failed to generate variation ${i + 1}:`, error);
      }
    }

    return results;
  }
}

export const replicateMusicGenService = new ReplicateMusicGenService();
