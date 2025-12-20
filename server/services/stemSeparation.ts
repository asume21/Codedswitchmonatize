import fetch from 'node-fetch';

interface StemSeparationResult {
  vocals?: string;
  accompaniment?: string;
  drums?: string;
  bass?: string;
  other?: string;
  piano?: string;
}

export class StemSeparationService {
  private apiToken: string;
  private apiUrl = 'https://api.replicate.com/v1';

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('REPLICATE_API_TOKEN not set - Stem separation will not work');
    }
  }

  async separateStems(
    audioUrl: string,
    stemCount: 2 | 4 | 5 = 2
  ): Promise<StemSeparationResult | null> {
    if (!this.apiToken) {
      console.error('Replicate API token not configured');
      return null;
    }

    try {
      console.log(`Separating audio into ${stemCount} stems: ${audioUrl}`);

      const predictionResponse = await fetch(`${this.apiUrl}/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'soykertje/spleeter',
          input: {
            audio: audioUrl,
            stems: stemCount,
          },
        }),
      });

      if (!predictionResponse.ok) {
        const error = await predictionResponse.text();
        console.error('Replicate API error:', error);
        return null;
      }

      const prediction = await predictionResponse.json() as any;
      const predictionId = prediction.id;

      console.log(`Waiting for stem separation (prediction ID: ${predictionId})`);

      let completed = false;
      let attempts = 0;
      const maxAttempts = 180;

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`${this.apiUrl}/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Token ${this.apiToken}`,
          },
        });

        if (!statusResponse.ok) {
          console.error('Failed to check prediction status');
          return null;
        }

        const status = await statusResponse.json() as any;

        if (status.status === 'succeeded') {
          console.log('Stem separation completed successfully');
          return status.output as StemSeparationResult;
        } else if (status.status === 'failed') {
          console.error('Stem separation failed:', status.error);
          return null;
        }

        attempts++;
      }

      console.error('Stem separation timeout');
      return null;

    } catch (error) {
      console.error('Stem separation error:', error);
      return null;
    }
  }

  isConfigured(): boolean {
    return !!this.apiToken;
  }
}

export const stemSeparationService = new StemSeparationService();
