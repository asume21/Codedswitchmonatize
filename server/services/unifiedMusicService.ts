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
   * Build professional music production prompt with genre-specific terminology
   */
  private buildProfessionalPrompt(basePrompt: string, options: {
    genre?: string;
    mood?: string;
    style?: string;
    bpm?: number;
    key?: string;
    energy?: string;
    vocals?: boolean;
    instrument?: string;
  }): string {
    const { genre = "pop", mood = "uplifting", style = "modern", bpm, key, energy, vocals, instrument } = options;
    
    // Genre-specific production terminology
    const genreTerms: Record<string, string> = {
      'hip-hop': 'hard-hitting 808 bass, crisp hi-hats, punchy kicks, trap-style percussion',
      'trap': 'rolling hi-hats, deep 808 sub-bass, snappy snares, dark atmospheric pads',
      'pop': 'catchy hooks, polished production, radio-ready mix, bright synths',
      'edm': 'powerful drops, sidechained bass, euphoric buildups, festival-ready energy',
      'house': 'four-on-the-floor kick, groovy bassline, shuffled hi-hats, warm chords',
      'techno': 'driving kick drum, hypnotic synth patterns, industrial textures, minimal arrangement',
      'r&b': 'smooth vocals, lush harmonies, warm bass, neo-soul chord progressions',
      'jazz': 'complex harmonies, swing rhythm, improvisational feel, acoustic instruments',
      'rock': 'distorted guitars, powerful drums, dynamic arrangement, raw energy',
      'classical': 'orchestral arrangement, dynamic expression, rich harmonics, acoustic ensemble',
      'lo-fi': 'vinyl crackle, mellow beats, jazzy chords, nostalgic warmth, tape saturation',
      'ambient': 'atmospheric textures, evolving pads, spacious reverb, ethereal soundscape',
      'drill': 'sliding 808s, aggressive hi-hats, dark melodies, UK drill percussion',
      'reggaeton': 'dembow rhythm, latin percussion, tropical vibes, dancehall influence'
    };
    
    // Mood descriptors
    const moodTerms: Record<string, string> = {
      'uplifting': 'major key, bright tones, positive energy, inspiring progression',
      'dark': 'minor key, ominous tones, tension, dramatic atmosphere',
      'chill': 'relaxed tempo, soft dynamics, smooth textures, laid-back groove',
      'energetic': 'high energy, driving rhythm, powerful dynamics, intense build',
      'melancholic': 'emotional depth, bittersweet harmonies, expressive melody',
      'aggressive': 'hard-hitting, intense, powerful, raw energy',
      'romantic': 'warm tones, gentle progression, intimate feel, emotional depth',
      'mysterious': 'suspenseful, enigmatic, atmospheric, tension-building'
    };
    
    const genreDesc = genreTerms[genre.toLowerCase()] || `${genre} style production`;
    const moodDesc = moodTerms[mood.toLowerCase()] || `${mood} atmosphere`;
    
    let prompt = `Professional ${genre} music production. ${basePrompt}. `;
    prompt += `Style: ${genreDesc}. `;
    prompt += `Mood: ${moodDesc}. `;
    if (bpm) prompt += `Tempo: ${bpm} BPM. `;
    if (key) prompt += `Key: ${key}. `;
    if (energy) prompt += `Energy level: ${energy}. `;
    if (style) prompt += `Production style: ${style}, studio-quality, professionally mixed. `;
    if (vocals === false) prompt += `Instrumental only, no vocals. `;
    if (instrument) prompt += `Featured instrument: ${instrument}. `;
    
    return prompt.trim();
  }

  /**
   * Generate full song with vocals using MiniMax Music-1.5
   * Supports up to 4 minutes with natural vocals and rich instrumentation
   * Cost: $0.03 per output
   */
  async generateFullSongWithVocals(prompt: string, lyrics: string, options: {
    genre?: string;
    mood?: string;
    duration?: number;
    style?: string;
  }): Promise<any> {
    try {
      const {
        genre = "pop",
        mood = "uplifting",
        duration = 120,
        style = "modern"
      } = options;

      console.log('🎤 UnifiedMusic: Generating full song WITH VOCALS using MiniMax Music-1.5...');

      // Build style prompt for MiniMax
      const stylePrompt = `${genre}, ${style}, ${mood}`;
      
      console.log('📝 Style prompt:', stylePrompt);
      console.log('📜 Lyrics:', lyrics.substring(0, 100) + '...');

      // MiniMax Music-1.5 - Full songs with vocals up to 4 minutes
      const output = await replicate.run(
        "minimax/music-1.5",
        {
          input: {
            lyrics: lyrics,
            prompt: stylePrompt
          }
        }
      );

      // MiniMax returns a FileOutput object with url() method
      const audioUrl = typeof output === 'object' && output !== null && 'url' in output 
        ? (output as any).url() 
        : output;

      return {
        status: 'success',
        audio_url: audioUrl,
        metadata: {
          duration,
          quality: "High quality with vocals",
          generator: "minimax-music-1.5",
          hasVocals: true,
          prompt: stylePrompt,
          lyrics: lyrics.substring(0, 200)
        }
      };
    } catch (error) {
      console.error("MiniMax song generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate studio-quality instrumental using MusicGen Large (stereo)
   * Best for instrumentals, beats, and backing tracks (no vocals)
   */
  async generateFullSong(prompt: string, options: {
    genre?: string;
    mood?: string;
    duration?: number;
    style?: string;
    vocals?: boolean;
    bpm?: number;
    key?: string;
    lyrics?: string;
  }): Promise<any> {
    try {
      const {
        genre = "pop",
        mood = "uplifting",
        duration = 30,
        style = "modern",
        vocals = true,
        bpm,
        key,
        lyrics
      } = options;

      // If vocals requested AND lyrics provided, use MiniMax Music-1.5
      if (vocals && lyrics && lyrics.length > 10) {
        console.log('🎤 Vocals requested with lyrics - using MiniMax Music-1.5');
        return this.generateFullSongWithVocals(prompt, lyrics, {
          genre, mood, duration: Math.min(duration, 240), style
        });
      }

      console.log('🎵 UnifiedMusic: Generating instrumental with optimized MusicGen...');

      // Build professional prompt with genre-specific terminology
      const musicPrompt = this.buildProfessionalPrompt(prompt, {
        genre, mood, style, bpm, key, vocals: false
      });

      console.log('📝 Professional prompt:', musicPrompt);

      // Use MusicGen stereo-melody-large for best quality instrumentals
      const output = await replicate.run(
        "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
        {
          input: {
            prompt: musicPrompt,
            duration: Math.min(duration, 30),
            model_version: "stereo-melody-large",
            output_format: "wav",
            normalization_strategy: "loudness",
            top_k: 250,
            top_p: 0.0,
            temperature: 0.8,
            classifier_free_guidance: 5.0
          }
        }
      );

      return {
        status: 'success',
        audio_url: output,
        metadata: {
          duration,
          quality: "48kHz stereo",
          generator: "musicgen-stereo-melody-large",
          hasVocals: false,
          prompt: musicPrompt
        }
      };
    } catch (error) {
      console.error("Full song generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate Beat, Melody, or Instrumental (MusicGen) with optimized parameters
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
      console.log(`🎼 UnifiedMusic: Generating ${type} with optimized settings...`);

      // Use professional prompt builder for all track types
      let fullPrompt: string;
      
      if (type === 'melody') {
        fullPrompt = this.buildProfessionalPrompt(prompt, {
          genre,
          instrument: instrument || 'piano',
          key: key || 'C Major',
          mood: 'melodic',
          energy
        });
        fullPrompt += ` Clear melodic line, memorable hook, professional arrangement.`;
      } else if (type === 'drum_pattern') {
        fullPrompt = this.buildProfessionalPrompt(`Drum pattern and percussion`, {
          genre,
          bpm: bpm || 120,
          energy: energy || 'medium'
        });
        fullPrompt += ` Drums and percussion only, no melodic instruments. Tight timing, punchy transients.`;
      } else if (type === 'instrumental') {
        fullPrompt = this.buildProfessionalPrompt(prompt, {
          genre,
          instrument,
          energy: energy || 'medium',
          vocals: false,
          style
        });
      } else {
        // Generic beat/track
        fullPrompt = this.buildProfessionalPrompt(prompt, {
          genre,
          energy: energy || 'medium',
          style: style || 'modern',
          bpm,
          key
        });
      }

      console.log('📝 Track prompt:', fullPrompt);

      const output = await replicate.run(
        "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
        {
          input: {
            prompt: fullPrompt,
            duration: Math.min(duration, 30),
            model_version: "stereo-melody-large",
            output_format: "wav",
            normalization_strategy: "loudness",
            top_k: 250,
            top_p: 0.0,
            temperature: 0.75,              // Lower for more coherent output
            classifier_free_guidance: 6.0   // Higher for better prompt adherence
          }
        }
      );

      return {
        status: 'success',
        audio_url: output,
        metadata: {
          type,
          duration,
          generator: "musicgen-stereo-melody-large",
          genre,
          key,
          bpm,
          prompt: fullPrompt
        }
      };
    } catch (error) {
      console.error(`${options.type} generation failed:`, error);
      throw error;
    }
  }

  /**
   * Blend Genres (MusicGen) with optimized fusion prompts
   */
  async blendGenres(primaryGenre: string, secondaryGenres: string[], prompt: string): Promise<any> {
    try {
      console.log('🎭 UnifiedMusic: Blending genres with optimized settings...');
      const genreList = [primaryGenre, ...secondaryGenres].join(" and ");
      
      // Build a professional fusion prompt
      const fullPrompt = this.buildProfessionalPrompt(
        `Innovative fusion of ${genreList}. ${prompt}`,
        {
          genre: primaryGenre,
          style: `fusion with ${secondaryGenres.join(', ')}`,
          mood: 'creative',
          energy: 'dynamic'
        }
      );
      fullPrompt + ` Seamless genre blending, creative transitions, unique sound design.`;

      console.log('📝 Fusion prompt:', fullPrompt);

      const output = await replicate.run(
        "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
        {
          input: {
            prompt: fullPrompt,
            duration: 30,
            model_version: "stereo-melody-large",
            output_format: "wav",
            normalization_strategy: "loudness",
            top_k: 250,
            top_p: 0.0,
            temperature: 0.9,               // Slightly higher for creative fusion
            classifier_free_guidance: 5.0   // Balanced for creativity + coherence
          }
        }
      );

      return {
        status: 'success',
        audio_url: output,
        metadata: {
          type: 'genre_blend',
          duration: 30,
          generator: "musicgen-stereo-melody-large",
          fusion_type: "genre_blend",
          genres: [primaryGenre, ...secondaryGenres],
          prompt: fullPrompt
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
