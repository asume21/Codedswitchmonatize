import Replicate from "replicate";
import { randomUUID } from "crypto";
import { localMusicGenService, LocalMusicGenPack, LocalMusicGenSample } from "./local-musicgen";
import { ObjectStorageService } from "../objectStorage";
import { getGenreSpec, enhancePromptWithGenre } from "../ai/knowledge/genreDatabase";

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
   * Enhanced with genre database intelligence for professional results
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

      console.log('🎵 UnifiedMusic: Generating full song with intelligence...');

      // Get genre-specific intelligence
      const genreSpec = getGenreSpec(genre);
      // bpmRange is [min, max] tuple - use average as default
      const smartBpm = bpm || (genreSpec?.bpmRange ? Math.round((genreSpec.bpmRange[0] + genreSpec.bpmRange[1]) / 2) : 120);
      const smartKey = key || genreSpec?.preferredKeys?.[0] || 'C Major';
      const genreMood = mood || genreSpec?.mood || 'energetic';
      const instruments = genreSpec?.instruments?.slice(0, 3).join(', ') || 'synths, drums';
      const productionTips = genreSpec?.productionTips?.[0] || 'professional mix';
      const bassStyle = genreSpec?.bassStyle || 'punchy bass';
      const drumPattern = genreSpec?.drumPattern || 'driving drums';
      
      console.log(`🧠 Song Intelligence: ${genre} → BPM: ${smartBpm}, Key: ${smartKey}, Style: ${genreMood}`);

      // Build rich prompt with genre knowledge
      const musicPrompt = vocals 
        ? `♪ ${prompt}. Professional ${genre} ${style} song in ${smartKey} at ${smartBpm} BPM. ${genreMood} mood with ${instruments}. ${bassStyle}, ${drumPattern}. ${productionTips}. Radio-ready mix. ♪`
        : `♪ ${prompt}. Professional ${genre} ${style} instrumental in ${smartKey} at ${smartBpm} BPM. ${genreMood} mood with ${instruments}. ${bassStyle}, ${drumPattern}. ${productionTips}. ♪`;
      
      console.log(`🎵 Enhanced Suno prompt: ${musicPrompt.substring(0, 100)}...`);

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
   * Enhanced with genre database intelligence for smarter prompts
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

      // Get genre-specific intelligence from our database
      const genreSpec = getGenreSpec(genre);
      // bpmRange is [min, max] tuple - use average as default
      const smartBpm = bpm || (genreSpec?.bpmRange ? Math.round((genreSpec.bpmRange[0] + genreSpec.bpmRange[1]) / 2) : 120);
      const smartKey = key || genreSpec?.preferredKeys?.[0] || 'C Minor';
      const smartInstruments = genreSpec?.instruments?.join(', ') || instrument || 'synths';
      const genreMood = genreSpec?.mood || 'energetic';
      const bassStyle = genreSpec?.bassStyle || 'punchy';
      const drumPattern = genreSpec?.drumPattern || 'standard';
      
      console.log(`🧠 Genre Intelligence: ${genre} → BPM: ${smartBpm}, Key: ${smartKey}, Mood: ${genreMood}`);

      let fullPrompt = prompt;
      
      // Construct rich prompt based on type with genre intelligence
      if (type === 'melody') {
        fullPrompt = `${instrument || smartInstruments} melody in ${smartKey} for ${genre} music. ${genreMood} mood. ${prompt}`;
      } else if (type === 'drum_pattern') {
        fullPrompt = `${genre} drum pattern at ${smartBpm} BPM. ${drumPattern} style. Percussion and drums only. ${genreMood} energy. ${prompt}`;
      } else if (type === 'instrumental') {
        fullPrompt = `Instrumental ${genre} track with ${smartInstruments}. ${smartKey} key, ${smartBpm} BPM. ${bassStyle} bass. Energy: ${energy || genreMood}. No vocals. ${prompt}`;
      } else {
        // Generic beat/track - enhanced with full genre knowledge
        fullPrompt = `${genre} beat at ${smartBpm} BPM in ${smartKey}. ${bassStyle} bass, ${drumPattern} drums. Instruments: ${smartInstruments}. Mood: ${genreMood}. ${prompt}`;
      }
      
      console.log(`🎵 Enhanced MusicGen prompt: ${fullPrompt.substring(0, 100)}...`);

      try {
        const output = await replicate.run(
          "meta/musicgen:2b5dc5f29cee83fd5cdf8f9c92e555aae7ca2a69b73c5182f3065362b2fa0a45",
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
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "";
        console.warn("MusicGen replicate error, attempting local fallback:", message);

        if (!process.env.PRIVATE_OBJECT_DIR) {
          throw new Error("Music provider temporarily unavailable. Please configure PRIVATE_OBJECT_DIR to enable fallback.");
        }

        try {
          // Fallback to local music generator to avoid hard failure
          const packs = await localMusicGenService.generateSamplePack(fullPrompt, 1);
          const firstSample = packs?.[0]?.samples?.[0];
          if (!firstSample?.audioUrl) {
            throw new Error("Local fallback did not return audio");
          }
          return {
            status: 'success',
            audio_url: firstSample.audioUrl,
            metadata: {
              type,
              duration: firstSample.duration ?? duration,
              generator: "local-musicgen-fallback",
              genre,
              key,
              bpm
            }
          };
        } catch (fallbackError: any) {
          console.error("Local MusicGen fallback failed:", fallbackError);
          throw new Error("Music provider temporarily unavailable. Please try again shortly.");
        }
      }
    } catch (error) {
      console.error(`${options.type} generation failed:`, error);
      throw error;
    }
  }

  /**
   * Blend Genres (MusicGen) - Enhanced with genre intelligence
   */
  async blendGenres(primaryGenre: string, secondaryGenres: string[], prompt: string): Promise<any> {
    try {
      console.log('🎭 UnifiedMusic: Blending genres with intelligence...');
      
      // Get specs for all genres to create intelligent fusion
      const primarySpec = getGenreSpec(primaryGenre);
      const secondarySpecs = secondaryGenres.map(g => getGenreSpec(g)).filter(Boolean);
      
      // Calculate blended BPM (average of all genres) - bpmRange is [min, max] tuple
      const getBpmAvg = (range?: [number, number]) => range ? Math.round((range[0] + range[1]) / 2) : null;
      const allBpms = [getBpmAvg(primarySpec?.bpmRange), ...secondarySpecs.map(s => getBpmAvg(s?.bpmRange))].filter(Boolean) as number[];
      const blendedBpm = allBpms.length > 0 ? Math.round(allBpms.reduce((a, b) => a + b, 0) / allBpms.length) : 120;
      
      // Combine instruments from all genres
      const allInstruments = new Set<string>();
      [primarySpec, ...secondarySpecs].forEach(spec => {
        spec?.instruments?.forEach(i => allInstruments.add(i));
      });
      const instrumentList = Array.from(allInstruments).slice(0, 5).join(', ');
      
      // Combine moods
      const moods = [primarySpec?.mood, ...secondarySpecs.map(s => s?.mood)].filter(Boolean);
      const moodBlend = moods.join(' meets ');
      
      const genreList = [primaryGenre, ...secondaryGenres].join(" and ");
      const fullPrompt = `Innovative fusion of ${genreList} at ${blendedBpm} BPM. Instruments: ${instrumentList}. Mood: ${moodBlend}. ${prompt}`;
      
      console.log(`🧠 Genre Fusion Intelligence: ${genreList} → BPM: ${blendedBpm}, Instruments: ${instrumentList}`);

      const output = await replicate.run(
        "meta/musicgen:2b5dc5f29cee83fd5cdf8f9c92e555aae7ca2a69b73c5182f3065362b2fa0a45",
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
      
      // Variation descriptors to make each pack unique
      const variations = [
        'energetic and driving',
        'melodic and atmospheric',
        'heavy and aggressive',
        'groovy and rhythmic',
        'dark and moody',
        'bright and uplifting',
        'minimal and spacious',
        'complex and layered'
      ];
      
      for (let i = 0; i < packCount; i++) {
        // Add variation to prompt to ensure different results
        const variation = variations[i % variations.length];
        const timestamp = Date.now();
        const randomSeed = Math.floor(Math.random() * 1000000);
        const variedPrompt = `${prompt}, ${variation} style, ${bpm} bpm, session ${timestamp}-${randomSeed}`;
        
        console.log(`🎵 Pack ${i + 1}: "${variedPrompt}"`);
        
        const output = await replicate.run(
          "andreasjansson/musicgen-looper:ad041aebc8406f8883e7f28313614c4a11c6e623dd934a54f2bf30127b4bc7a8",
          {
            input: {
              prompt: variedPrompt,
              bpm: bpm,
              variations: 4,
              max_duration: 8,
              seed: randomSeed,  // Random seed for variation
              temperature: 1.0,   // Higher temperature = more variation
              top_k: 250,         // Sampling diversity
              top_p: 0.0          // Nucleus sampling disabled for more randomness
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
