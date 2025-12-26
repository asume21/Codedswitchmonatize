import Replicate from "replicate";
import { randomUUID } from "crypto";
import { localMusicGenService, LocalMusicGenPack, LocalMusicGenSample } from "./local-musicgen";
import { ObjectStorageService } from "../objectStorage";

// Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export interface MusicSample {
  id: string;
  name: string;
  prompt: string;
  audioUrl?: string;
  duration: number;
  type: 'loop' | 'oneshot' | 'midi';
  instrument: string;
  bpm?: number;
  key?: string;
  aiData?: any;
}

export interface MusicPack {
  id: string;
  title: string;
  description: string;
  bpm: number;
  key: string;
  genre: string;
  samples: MusicSample[];
  metadata: {
    energy: number;
    mood: string;
    instruments: string[];
    tags: string[];
  };
}

/**
 * Unified Music Service
 * Consolidates all music generation capabilities:
 * - Full Songs (Suno/Bark via Replicate)
 * - Beats/Melodies (MusicGen via Replicate)
 * - Sample Packs (MusicGen Looper via Replicate + Local Fallback)
 */
export class UnifiedMusicService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Generate studio-quality full song (Suno/Bark)
   */
  async generateFullSong(prompt: string, options: {
    genre?: string;
    mood?: string;
    duration?: number;
    style?: string;
    vocals?: boolean;
    bpm?: number;
    key?: string;
  }): Promise<any> {
    try {
      const {
        genre = "pop",
        mood = "uplifting",
        duration = 30,
        style = "modern",
        vocals = true,
        bpm,
        key
      } = options;

      console.log('🎵 UnifiedMusic: Generating full song...');

      const musicPrompt = vocals 
        ? `♪ ${prompt}. ${genre} ${style} song, ${mood} mood${key ? ` in ${key}` : ''}${bpm ? ` at ${bpm} BPM` : ''} ♪`
        : `♪ ${prompt}. ${genre} ${style} instrumental, ${mood} mood${key ? ` in ${key}` : ''}${bpm ? ` at ${bpm} BPM` : ''} ♪`;

      const output = await replicate.run(
        "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56ab96c4e91ce03b79b2787",
        {
          input: {
            prompt: musicPrompt,
            text_temp: 0.7,
            waveform_temp: 0.7,
            history_prompt: "announcer"
          }
        }
      );

      return {
        status: 'success',
        audio_url: output,
        metadata: {
          duration,
          quality: "24kHz",
          generator: "suno-bark"
        }
      };
    } catch (error) {
      console.error("Full song generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate Beat, Melody, or Instrumental (MusicGen)
   */
  async generateTrack(prompt: string, options: {
    type: 'beat' | 'melody' | 'instrumental' | 'drum_pattern';
    genre?: string;
    duration?: number;
    instrument?: string;
    energy?: string;
    style?: string;
    key?: string;
    bpm?: number;
  }): Promise<any> {
    try {
      const { type, genre = "pop", duration = 30, instrument, energy, style, key, bpm } = options;
      console.log(`🎼 UnifiedMusic: Generating ${type}...`);

      let fullPrompt = prompt;
      
      // Construct rich prompt based on type
      if (type === 'melody') {
        fullPrompt = `${instrument || 'piano'} melody in ${key || 'C Major'} for ${genre} music. ${prompt}`;
      } else if (type === 'drum_pattern') {
        fullPrompt = `${genre} drum pattern at ${bpm || 120} BPM. Percussion and drums only. ${prompt}`;
      } else if (type === 'instrumental') {
        fullPrompt = `Instrumental ${genre} track with ${instrument || 'instruments'}. Energy: ${energy || 'medium'}. No vocals. ${prompt}`;
      } else {
        // Generic beat/track
        fullPrompt = `${prompt}. Genre: ${genre}, Energy: ${energy || 'medium'}, Style: ${style || 'modern'}.`;
      }

      const output = await replicate.run(
        "facebook/musicgen:7a76a8258b23fae65c5a22debb8f7c8aad349f462d4b3d50105d5fda6b033ea3",
        {
          input: {
            prompt: fullPrompt,
            duration: Math.min(duration, 30),
            temperature: 1.0,
            top_k: 250,
            top_p: 0.0,
            cfg_coef: 3.0
          }
        }
      );

      return {
        status: 'success',
        audio_url: output,
        metadata: {
          type,
          duration,
          generator: "musicgen",
          genre,
          key,
          bpm
        }
      };
    } catch (error) {
      console.error(`${options.type} generation failed:`, error);
      throw error;
    }
  }

  /**
   * Blend Genres (MusicGen)
   */
  async blendGenres(primaryGenre: string, secondaryGenres: string[], prompt: string): Promise<any> {
    try {
      console.log('🎭 UnifiedMusic: Blending genres...');
      const genreList = [primaryGenre, ...secondaryGenres].join(" and ");
      const fullPrompt = `Innovative fusion of ${genreList}. ${prompt}`;

      const output = await replicate.run(
        "facebook/musicgen:7a76a8258b23fae65c5a22debb8f7c8aad349f462d4b3d50105d5fda6b033ea3",
        {
          input: {
            prompt: fullPrompt,
            duration: 30,
            temperature: 1.2,
            top_k: 250,
            top_p: 0.0,
            cfg_coef: 3.0
          }
        }
      );

      return {
        status: 'success',
        audio_url: output,
        metadata: {
          type: 'genre_blend',
          duration: 30,
          generator: "musicgen",
          fusion_type: "genre_blend"
        }
      };
    } catch (error) {
      console.error("Genre blending failed:", error);
      throw error;
    }
  }

  /**
   * Generate Sample Pack (Replicate Looper -> Local Fallback)
   */
  async generateSamplePack(prompt: string, options: {
    bpm?: number;
    packCount?: number;
  } = {}): Promise<MusicPack[]> {
    const { bpm = 120, packCount = 1 } = options;
    console.log(`📦 UnifiedMusic: Generating sample packs for "${prompt}"`);

    try {
      // Try Replicate MusicGen-Looper first
      if (!process.env.REPLICATE_API_TOKEN) throw new Error("No Replicate token");

      const packs: MusicPack[] = [];
      
      for (let i = 0; i < packCount; i++) {
        const output = await replicate.run(
          "andreasjansson/musicgen-looper:ad041aebc8406f8883e7f28313614c4a11c6e623dd934a54f2bf30127b4bc7a8",
          {
            input: {
              prompt: `${prompt}, ${bpm} bpm`,
              bpm: bpm,
              variations: 4,
              max_duration: 8
            }
          }
        );

        if (typeof output === 'object' && output !== null) {
          const samples: MusicSample[] = Object.entries(output)
            .filter(([k]) => k.startsWith('variation_'))
            .map(([k, url], idx) => ({
              id: `sample_${randomUUID()}`,
              name: `${prompt} Var ${idx + 1}`,
              prompt,
              audioUrl: url as string,
              duration: 8,
              type: 'loop',
              instrument: 'mixed',
              bpm
            }));

          packs.push({
            id: `pack_${randomUUID()}`,
            title: `${prompt} AI Pack ${i + 1}`,
            description: `AI generated loop pack`,
            bpm,
            key: 'C',
            genre: 'electronic',
            samples,
            metadata: {
              energy: 0.8,
              mood: 'generated',
              instruments: ['mixed'],
              tags: ['ai', 'replicate']
            }
          });
        }
      }
      
      return packs;

    } catch (error) {
      console.warn("⚠️ Replicate generation failed, falling back to Local MusicGen:", error);
      // Fallback to Local Algorithmic Generation
      const localPacks = await localMusicGenService.generateSamplePack(prompt, packCount);
      
      // Adapt Local types to Unified types
      return localPacks.map(lp => ({
        ...lp,
        samples: lp.samples.map(ls => ({
          ...ls,
          type: ls.type, // compatible
          audioUrl: ls.audioUrl
        }))
      }));
    }
  }

  // Helper for direct raw access if needed
  async rawReplicateCall(model: string, input: any): Promise<any> {
    return await replicate.run(model as any, { input });
  }
}

export const unifiedMusicService = new UnifiedMusicService();
