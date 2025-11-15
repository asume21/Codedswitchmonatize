import { HfInference } from '@huggingface/inference';
import fs from 'fs';
import path from 'path';
import { randomUUID, randomInt } from 'crypto';
import { ObjectStorageService } from '../objectStorage';
import { replicateMusicGenService } from './replicate-musicgen';

// Initialize Hugging Face client only if valid API key is provided
let hf: any = null;
try {
  if (process.env.HUGGINGFACE_API_KEY && !process.env.HUGGINGFACE_API_KEY.includes('your-') && process.env.HUGGINGFACE_API_KEY.length > 20) {
    hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    console.log('✅ Hugging Face client initialized successfully');
  } else {
    console.log('⚠️ Hugging Face API key not configured - using metadata-only generation');
  }
} catch (error) {
  console.error('❌ Failed to initialize Hugging Face client:', error);
  hf = null;
}

export interface MusicGenSample {
  id: string;
  name: string;
  prompt: string;
  audioUrl?: string; // Optional - undefined means use synthesis
  duration: number;
  type: 'loop' | 'oneshot' | 'midi';
  instrument: string;
  localPath?: string;
  aiData?: {
    notes?: string[];
    pattern?: number[];
    intensity?: number;
  };
}

export interface MusicGenPack {
  id: string;
  title: string;
  description: string;
  bpm: number;
  key: string;
  genre: string;
  samples: MusicGenSample[];
  metadata: {
    energy: number;
    mood: string;
    instruments: string[];
    tags: string[];
  };
}

export class MusicGenService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Generate a sample pack using Local MusicGen (real audio synthesis)
   */
  async generateSamplePack(prompt: string, packCount: number = 4): Promise<MusicGenPack[]> {
    console.log(`🎵 MusicGen: Generating ${packCount} packs for prompt: "${prompt}"`);

    try {
      // Use Replicate for REAL AI audio generation
      console.log(`🎵 Using Replicate MusicGen for real AI audio synthesis...`);
      const audioUrls = await replicateMusicGenService.generateMusicBatch(prompt, packCount, 10);
      
      if (!audioUrls || audioUrls.length === 0) {
        throw new Error('No audio generated from Replicate');
      }
      
      // Convert audio URLs to sample packs
      const packs: MusicGenPack[] = [];
      const variations = ['Original', 'Energetic', 'Ambient', 'Upbeat'];
      
      for (let i = 0; i < audioUrls.length; i++) {
        packs.push({
          id: `pack_${randomUUID()}`,
          title: `${prompt} - ${variations[i % variations.length]}`,
          description: `AI-generated ${prompt} pack (${variations[i % variations.length]} version)`,
          bpm: this.getBpmForGenre(prompt.toLowerCase()),
          key: this.getKeyForGenre(prompt.toLowerCase()),
          genre: this.detectGenre(prompt.toLowerCase()),
          samples: [
            {
              id: `sample_${randomUUID()}`,
              name: `${prompt} Audio`,
              prompt: prompt,
              audioUrl: audioUrls[i],
              duration: 10,
              type: 'loop',
              instrument: 'ai-generated'
            }
          ],
          metadata: {
            energy: 70,
            mood: variations[i % variations.length].toLowerCase(),
            instruments: ['AI Generated'],
            tags: [prompt, 'replicate', 'musicgen']
          }
        });
      }

      console.log(`✅ Replicate MusicGen generated ${packs.length} packs with REAL AI AUDIO`);
      return packs;

    } catch (error) {
      console.error(`❌ Replicate MusicGen failed:`, error);
      console.log(`🔄 Falling back to metadata-only generation...`);
      return this.generateSamplePackFallback(prompt, packCount);
    }
  }

  /**
   * Fallback method for metadata-only generation (when real audio fails)
   */
  private async generateSamplePackFallback(prompt: string, packCount: number = 4): Promise<MusicGenPack[]> {
    console.log(`🎵 MusicGen Fallback: Generating ${packCount} metadata-only packs for prompt: "${prompt}"`);

    const packs: MusicGenPack[] = [];

    // Generate multiple themed packs based on the prompt
    const packThemes = this.generatePackThemes(prompt, packCount);

    for (const theme of packThemes) {
      try {
        console.log(`🎵 Generating fallback pack: "${theme.title}"`);
        const pack = await this.generateSinglePack(theme, prompt);
        packs.push(pack);
      } catch (error) {
        console.error(`❌ Failed to generate pack "${theme.title}":`, error);
        // Continue with other packs even if one fails
      }
    }

    console.log(`✅ MusicGen fallback generated ${packs.length} packs (metadata-only)`);
    return packs;
  }

  /**
   * Generate themes for multiple packs based on the user prompt
   */
  private generatePackThemes(prompt: string, count: number) {
    const themes = [];
    const promptLower = prompt.toLowerCase();

    // Base theme variations
    const variations = [
      { suffix: "melodic elements", energy: 60, mood: "uplifting" },
      { suffix: "heavy drums", energy: 85, mood: "intense" },
      { suffix: "ambient textures", energy: 40, mood: "dreamy" },
      { suffix: "rhythmic percussion", energy: 75, mood: "energetic" }
    ];

    // Generate unique themes
    for (let i = 0; i < count && i < variations.length; i++) {
      const variation = variations[i];
      themes.push({
        title: `${this.capitalizeFirst(prompt)} - ${this.capitalizeFirst(variation.suffix)}`,
        description: `AI-generated ${prompt} pack focusing on ${variation.suffix}`,
        basePrompt: `${prompt} with ${variation.suffix}`,
        energy: variation.energy,
        mood: variation.mood,
        bpm: this.getBpmForGenre(promptLower),
        key: this.getKeyForGenre(promptLower),
        genre: this.detectGenre(promptLower)
      });
    }

    return themes;
  }

  /**
   * Generate a single pack with multiple AI-generated audio samples
   */
  private async generateSinglePack(theme: any, originalPrompt: string): Promise<MusicGenPack> {
    const packId = `pack_${randomUUID()}`;
    const samples: MusicGenSample[] = [];

    // Generate 3-5 samples per pack with different musical elements
    const samplePrompts = this.generateSamplePrompts(theme.basePrompt, theme.genre);

    for (const samplePrompt of samplePrompts) {
      try {
        console.log(`🎵 Generating audio for: "${samplePrompt.name}"`);
        const sample = await this.generateAudioSample(samplePrompt, packId);
        samples.push(sample);
      } catch (error) {
        console.error(`❌ Failed to generate sample "${samplePrompt.name}":`, error);
        // Continue with other samples
      }
    }

    return {
      id: packId,
      title: theme.title,
      description: theme.description,
      bpm: theme.bpm,
      key: theme.key,
      genre: theme.genre,
      samples,
      metadata: {
        energy: theme.energy,
        mood: theme.mood,
        instruments: this.extractInstruments(samples),
        tags: [theme.genre.toLowerCase(), theme.mood, originalPrompt]
      }
    };
  }

  /**
   * Generate specific sample prompts for different musical elements with AI-generated musical data
   */
  private generateSamplePrompts(basePrompt: string, genre: string) {
    // Use AI-like logic to create truly varied samples based on prompt
    const promptWords = basePrompt.toLowerCase().split(' ');
    const hasRhythm = promptWords.some(w => ['drum', 'beat', 'rhythm', 'percussion'].includes(w));
    const hasBass = promptWords.some(w => ['bass', 'low', 'sub', 'deep'].includes(w));
    const hasEnergy = promptWords.some(w => ['energetic', 'intense', 'heavy', 'aggressive'].includes(w));
    const isAmbient = promptWords.some(w => ['ambient', 'chill', 'atmospheric', 'dreamy'].includes(w));

    const elements = [];

    // AI-generated lead melody based on prompt characteristics
    if (!isAmbient || hasEnergy) {
      elements.push({
        name: hasEnergy ? "Aggressive Lead Synth" : "Melodic Lead",
        prompt: `${basePrompt} melodic lead, ${hasEnergy ? 'aggressive and cutting' : 'catchy and memorable'}`,
        type: "loop" as const,
        instrument: hasEnergy ? "lead-synth" : "melody",
        duration: hasEnergy ? 6 : 8,
        // AI-generated musical characteristics
        aiData: {
          notes: this.generateNotesForPrompt(basePrompt, 'lead'),
          pattern: this.generateRhythmPattern(basePrompt, 'lead'),
          intensity: hasEnergy ? 0.9 : 0.6
        }
      });
    }

    // AI-generated drums based on prompt analysis
    if (hasRhythm || !isAmbient) {
      elements.push({
        name: hasEnergy ? "Heavy Drum Kit" : "Drum Pattern",
        prompt: `${basePrompt} drum pattern, ${hasEnergy ? 'heavy and pounding' : 'rhythmic and driving'}`,
        type: "loop" as const,
        instrument: "drums",
        duration: hasEnergy ? 2 : 4,
        aiData: {
          pattern: this.generateRhythmPattern(basePrompt, 'drums'),
          intensity: hasEnergy ? 0.95 : 0.7
        }
      });
    }

    // AI-generated bass based on prompt
    if (hasBass || hasEnergy) {
      elements.push({
        name: hasEnergy ? "Sub Bass Drop" : "Bass Line",
        prompt: `${basePrompt} bass line, ${hasEnergy ? 'rumbling and powerful' : 'deep and groovy'}`,
        type: "loop" as const,
        instrument: "bass",
        duration: hasEnergy ? 4 : 8,
        aiData: {
          notes: this.generateNotesForPrompt(basePrompt, 'bass'),
          pattern: this.generateRhythmPattern(basePrompt, 'bass'),
          intensity: hasEnergy ? 0.8 : 0.5
        }
      });
    }

    // AI-generated ambient elements
    if (isAmbient || !hasEnergy) {
      elements.push({
        name: isAmbient ? "Atmospheric Pad" : "Harmony Pad",
        prompt: `${basePrompt} harmony pad, ${isAmbient ? 'ethereal and floating' : 'atmospheric and supporting'}`,
        type: "loop" as const,
        instrument: "pad",
        duration: isAmbient ? 20 : 16,
        aiData: {
          notes: this.generateNotesForPrompt(basePrompt, 'pad'),
          pattern: this.generateRhythmPattern(basePrompt, 'pad'),
          intensity: isAmbient ? 0.3 : 0.4
        }
      });
    }

    return elements;
  }

  /**
   * Generate AI-driven note sequences based on prompt analysis
   */
  private generateNotesForPrompt(prompt: string, instrument: string): string[] {
    const promptLower = prompt.toLowerCase();

    // AI analyzes prompt to choose appropriate scales and notes
    if (promptLower.includes('dark') || promptLower.includes('heavy')) {
      return instrument === 'bass' ? ['C2', 'D#2', 'F2', 'G#2'] : ['C', 'D#', 'F', 'G#', 'A#'];
    } else if (promptLower.includes('happy') || promptLower.includes('upbeat')) {
      return instrument === 'bass' ? ['C2', 'E2', 'G2', 'A2'] : ['C', 'E', 'G', 'A', 'D', 'F'];
    } else if (promptLower.includes('ambient') || promptLower.includes('dreamy')) {
      return instrument === 'bass' ? ['C2', 'F2', 'G2'] : ['C', 'F', 'G', 'Am', 'Dm'];
    } else if (promptLower.includes('jazz')) {
      return instrument === 'bass' ? ['C2', 'E2', 'G2', 'B2'] : ['Cmaj7', 'Am7', 'Dm7', 'G7'];
    }

    // Default intelligent scale selection
    return instrument === 'bass' ? ['C2', 'D2', 'E2', 'G2', 'A2'] : ['C', 'D', 'E', 'G', 'A'];
  }

  /**
   * Generate AI-driven rhythm patterns based on prompt analysis
   */
  private generateRhythmPattern(prompt: string, instrument: string): number[] {
    const promptLower = prompt.toLowerCase();

    // AI creates rhythm patterns based on musical understanding
    if (promptLower.includes('hip hop') || promptLower.includes('trap')) {
      return instrument === 'drums' ? 
        [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0] : // Hip hop pattern
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];   // Simple bass
    } else if (promptLower.includes('house') || promptLower.includes('techno')) {
      return instrument === 'drums' ?
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] : // Four-on-floor
        [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];   // House bass
    } else if (promptLower.includes('drum') && promptLower.includes('bass')) {
      return instrument === 'drums' ?
        [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0] : // DnB pattern
        [1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1];   // DnB bass
    }

    // Default intelligent pattern
    return instrument === 'drums' ?
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] :
      [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  }

  /**
   * Generate actual audio using MusicGen (fallback to metadata-only if API unavailable)
   */
  private async generateAudioSample(samplePrompt: any, packId: string): Promise<MusicGenSample> {
    const sampleId = `sample_${randomUUID()}`;

    // Check if Hugging Face client is available
    if (!hf) {
      console.log(`⚠️ Hugging Face client not available - using metadata-only generation for: ${samplePrompt.name}`);
      return {
        id: sampleId,
        name: samplePrompt.name,
        prompt: samplePrompt.prompt,
        audioUrl: undefined, // No real audio - will use synthesis
        duration: samplePrompt.duration,
        type: samplePrompt.type,
        instrument: samplePrompt.instrument,
        // Include AI musical data for intelligent synthesis
        aiData: samplePrompt.aiData
      };
    }

    try {
      console.log(`🎵 Calling MusicGen API for: "${samplePrompt.prompt}"`);
      
      // Use Hugging Face Inference API for MusicGen with correct format
      const audioResponse = await fetch(
        "https://api-inference.huggingface.co/models/facebook/musicgen-melody",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: samplePrompt.prompt,
            parameters: {
              guidance_scale: 3.0,
              max_new_tokens: Math.min(samplePrompt.duration * 50, 1024),
              do_sample: true
            },
            options: {
              wait_for_model: true,
              use_cache: false
            }
          })
        }
      );

      if (!audioResponse.ok) {
        const errorText = await audioResponse.text();
        console.error(`❌ MusicGen API error (${audioResponse.status}):`, errorText);

        // Check if model is loading - retry once after delay
        if (audioResponse.status === 503) {
          console.log(`🔄 MusicGen model is loading, waiting 15 seconds and retrying...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          // Retry the request once
          const retryResponse = await fetch(
            "https://api-inference.huggingface.co/models/facebook/musicgen-melody",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inputs: samplePrompt.prompt,
                parameters: {
                  guidance_scale: 3.0,
                  max_new_tokens: Math.min(samplePrompt.duration * 50, 1024),
                  do_sample: true
                },
                options: {
                  wait_for_model: true,
                  use_cache: false
                }
              })
            }
          );
          
          if (!retryResponse.ok) {
            throw new Error(`MusicGen still unavailable after retry: ${retryResponse.status}`);
          }
          
          // Use retry response
          const retryData = await retryResponse.json();
          return await this.processAudioResponse(retryData, samplePrompt, packId, sampleId);
        }

        // Check for authentication issues
        if (audioResponse.status === 401) {
          throw new Error('Invalid Hugging Face API key. Please check your HUGGINGFACE_API_KEY.');
        }

        throw new Error(`MusicGen API error: ${audioResponse.status} - ${errorText}`);
      }

      // Parse JSON response (not blob) - MusicGen returns audio data in JSON format
      const responseData = await audioResponse.json();
      console.log(`✅ MusicGen API responded successfully`);
      
      return await this.processAudioResponse(responseData, samplePrompt, packId, sampleId);

    } catch (error) {
      console.error(`❌ MusicGen audio generation failed:`, error);

      // Fallback to metadata-only sample with AI-generated musical data
      return {
        id: sampleId,
        name: samplePrompt.name,
        prompt: samplePrompt.prompt,
        audioUrl: undefined, // No real audio - will use synthesis
        duration: samplePrompt.duration,
        type: samplePrompt.type,
        instrument: samplePrompt.instrument,
        // Include AI musical data for intelligent synthesis
        aiData: samplePrompt.aiData
      };
    }
  }

  /**
   * Process the audio response from MusicGen API
   */
  private async processAudioResponse(responseData: any, samplePrompt: any, packId: string, sampleId: string): Promise<MusicGenSample> {
    try {
      // Handle different response formats
      let audioArray;
      
      if (Array.isArray(responseData) && responseData.length > 0) {
        // Response is array format: [{"generated_audio": [...]}]
        if (responseData[0]?.generated_audio) {
          audioArray = responseData[0].generated_audio;
        } else if (Array.isArray(responseData[0])) {
          audioArray = responseData[0];
        }
      } else if (responseData?.generated_audio) {
        // Response is object format: {"generated_audio": [...]}
        audioArray = responseData.generated_audio;
      } else if (Array.isArray(responseData)) {
        // Response is direct array format: [...]
        audioArray = responseData;
      }

      if (!audioArray || !Array.isArray(audioArray) || audioArray.length === 0) {
        throw new Error('Invalid audio data format from MusicGen API');
      }

      console.log(`✅ MusicGen generated audio array with ${audioArray.length} samples`);

      // Convert audio array to WAV format
      const wavBuffer = await this.convertAudioArrayToWav(audioArray);

      // Save to temp file with path validation
      const tempFileName = `${sampleId}.wav`;
      const basePath = '/tmp';
      const joinedPath = path.join(basePath, path.basename(tempFileName));
      const tempPath = path.normalize(joinedPath);
      
      // Validate path is within basePath
      if (!tempPath.startsWith(basePath)) {
        throw new Error('Invalid file path');
      }
      
      fs.writeFileSync(tempPath, wavBuffer);

      console.log(`💾 Saved MusicGen audio: ${tempPath} (${wavBuffer.length} bytes)`);

      // Upload to object storage
      const objectPath = await this.uploadToObjectStorage(tempPath, packId, sampleId);

      // Clean up temp file (path already validated above)
      fs.unlinkSync(tempPath);

      return {
        id: sampleId,
        name: samplePrompt.name,
        prompt: samplePrompt.prompt,
        audioUrl: objectPath, // Real audio file from MusicGen!
        duration: samplePrompt.duration,
        type: samplePrompt.type,
        instrument: samplePrompt.instrument
      };

    } catch (error) {
      console.error(`❌ Failed to process MusicGen audio response:`, error);
      throw error;
    }
  }

  /**
   * Convert audio array to WAV format
   */
  private async convertAudioArrayToWav(audioArray: number[]): Promise<Buffer> {
    // MusicGen outputs audio at 32kHz sample rate
    const sampleRate = 32000;
    const numChannels = 1; // Mono
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    
    // Convert float32 audio to int16
    const int16Array = new Int16Array(audioArray.length);
    for (let i = 0; i < audioArray.length; i++) {
      // Clamp values between -1 and 1, then convert to int16
      const clampedValue = Math.max(-1, Math.min(1, audioArray[i]));
      int16Array[i] = Math.round(clampedValue * 32767);
    }

    // Create WAV header
    const headerLength = 44;
    const dataLength = int16Array.length * bytesPerSample;
    const fileLength = headerLength + dataLength;

    const wavBuffer = Buffer.alloc(fileLength);
    let offset = 0;

    // RIFF header
    wavBuffer.write('RIFF', offset); offset += 4;
    wavBuffer.writeUInt32LE(fileLength - 8, offset); offset += 4;
    wavBuffer.write('WAVE', offset); offset += 4;

    // fmt chunk
    wavBuffer.write('fmt ', offset); offset += 4;
    wavBuffer.writeUInt32LE(16, offset); offset += 4; // chunk size
    wavBuffer.writeUInt16LE(1, offset); offset += 2; // audio format (PCM)
    wavBuffer.writeUInt16LE(numChannels, offset); offset += 2;
    wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
    wavBuffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4; // byte rate
    wavBuffer.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2; // block align
    wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    wavBuffer.write('data', offset); offset += 4;
    wavBuffer.writeUInt32LE(dataLength, offset); offset += 4;

    // Write audio data
    for (let i = 0; i < int16Array.length; i++) {
      wavBuffer.writeInt16LE(int16Array[i], offset);
      offset += 2;
    }

    return wavBuffer;
  }

  /**
   * Upload generated audio to object storage
   */
  private async uploadToObjectStorage(filePath: string, packId: string, sampleId: string): Promise<string> {
    try {
      // Get upload URL
      const uploadUrl = await this.objectStorage.getObjectEntityUploadURL();

      // Validate and read file
      const normalizedPath = path.normalize(filePath);
      
      // Basic validation - ensure it's in /tmp
      if (!normalizedPath.startsWith('/tmp')) {
        throw new Error('Invalid file path - must be in /tmp');
      }
      
      const fileBuffer = fs.readFileSync(normalizedPath);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': 'audio/wav'
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // Return the object path
      const objectPath = `/objects/uploads/${sampleId}`;
      console.log(`☁️ Uploaded audio to: ${objectPath}`);

      return objectPath;

    } catch (error) {
      console.error(`❌ Object storage upload failed:`, error);
      throw error;
    }
  }

  // Helper methods
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getBpmForGenre(genre: string): number {
    if (genre.includes('hip hop') || genre.includes('trap')) return 140;
    if (genre.includes('house') || genre.includes('techno')) return 128;
    if (genre.includes('drum') && genre.includes('bass')) return 174;
    if (genre.includes('ambient') || genre.includes('chill')) return 80;
    return 120; // Default
  }

  private getKeyForGenre(genre: string): string {
    const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Am', 'Dm', 'Em'];
    // Use cryptographically secure random number generator
    return keys[randomInt(0, keys.length)];
  }

  private detectGenre(prompt: string): string {
    if (prompt.includes('hip hop')) return 'Hip Hop';
    if (prompt.includes('trap')) return 'Trap';
    if (prompt.includes('house')) return 'House';
    if (prompt.includes('techno')) return 'Techno';
    if (prompt.includes('ambient')) return 'Ambient';
    if (prompt.includes('drum') && prompt.includes('bass')) return 'Drum & Bass';
    return 'Electronic';
  }

  private extractInstruments(samples: MusicGenSample[]): string[] {
    const instruments = samples.map(s => s.instrument);
    return Array.from(new Set(instruments));
  }
}

export const musicGenService = new MusicGenService();
