import fetch from 'node-fetch';
import FormData from 'form-data';

const BASE_URL = 'https://api.elevenlabs.io/v1';

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url?: string;
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export class ElevenLabsService {
  private getApiKey(): string {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }
    return key;
  }

  private getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'xi-api-key': this.getApiKey(),
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  async listVoices(): Promise<Voice[]> {
    const response = await fetch(`${BASE_URL}/voices`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list voices: ${response.statusText}`);
    }

    const data = await response.json() as { voices: Voice[] };
    return data.voices;
  }

  async getVoice(voiceId: string): Promise<Voice> {
    const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get voice: ${response.statusText}`);
    }

    return await response.json() as Voice;
  }

  async cloneVoice(
    name: string,
    description: string,
    audioFiles: Buffer[],
    labels?: Record<string, string>
  ): Promise<Voice> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    
    if (labels) {
      formData.append('labels', JSON.stringify(labels));
    }

    audioFiles.forEach((file, index) => {
      formData.append('files', file, {
        filename: `sample_${index}.mp3`,
        contentType: 'audio/mpeg',
      });
    });

    const response = await fetch(`${BASE_URL}/voices/add`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData as any,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to clone voice: ${error}`);
    }

    return await response.json() as Voice;
  }

  async deleteVoice(voiceId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete voice: ${response.statusText}`);
    }
  }

  async textToSpeech(
    voiceId: string,
    text: string,
    settings?: VoiceSettings
  ): Promise<Buffer> {
    const defaultSettings: VoiceSettings = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
    };

    const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: this.getHeaders('application/json'),
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { ...defaultSettings, ...settings },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate speech: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async speechToSpeech(
    voiceId: string,
    audioBuffer: Buffer,
    settings?: VoiceSettings
  ): Promise<Buffer> {
    // Check file size - ElevenLabs STS works best with files under 10MB
    const fileSizeMB = audioBuffer.length / (1024 * 1024);
    console.log(`[ElevenLabs STS] Processing ${fileSizeMB.toFixed(2)} MB audio file`);
    
    if (fileSizeMB > 25) {
      throw new Error(`Audio file too large (${fileSizeMB.toFixed(1)}MB). Maximum is 25MB for speech-to-speech.`);
    }

    const formData = new FormData();
    formData.append('audio', audioBuffer, {
      filename: 'input.mp3',
      contentType: 'audio/mpeg',
    });
    formData.append('model_id', 'eleven_english_sts_v2');
    
    if (settings) {
      formData.append('voice_settings', JSON.stringify(settings));
    }

    // Add timeout for large files (5 minutes max)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch(`${BASE_URL}/speech-to-speech/${voiceId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData as any,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to convert speech: ${error}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log(`[ElevenLabs STS] Conversion complete, output: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`);
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Speech-to-speech conversion timed out after 5 minutes. Try a shorter audio clip.');
      }
      throw error;
    }
  }

  async isolateAudio(audioBuffer: Buffer): Promise<Buffer> {
    const formData = new FormData();
    formData.append('audio', audioBuffer, {
      filename: 'input.mp3',
      contentType: 'audio/mpeg',
    });

    const response = await fetch(`${BASE_URL}/audio-isolation`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData as any,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to isolate audio: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getSubscriptionInfo(): Promise<{
    character_count: number;
    character_limit: number;
    can_extend_character_limit: boolean;
  }> {
    const response = await fetch(`${BASE_URL}/user/subscription`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get subscription: ${response.statusText}`);
    }

    return await response.json() as any;
  }
}

export const elevenLabsService = new ElevenLabsService();
