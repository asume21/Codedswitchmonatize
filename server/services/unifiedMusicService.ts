import Replicate from "replicate";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { localMusicGenService, LocalMusicGenPack, LocalMusicGenSample } from "./local-musicgen";
import { ObjectStorageService } from "../objectStorage";
import { getGenreSpec, enhancePromptWithGenre } from "../ai/knowledge/genreDatabase";

const LOCAL_OBJECTS_DIR =
  fs.existsSync("/data") && fs.statSync("/data").isDirectory()
    ? path.resolve("/data", "objects")
    : path.resolve(process.cwd(), "objects");

fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const duration = metadata?.format?.duration ?? 0;
      resolve(duration);
    });
  });
}

async function polishGeneratedAudio(sourceUrl: string): Promise<{ url: string; duration: number }> {
  const inputPath = path.join(os.tmpdir(), `ai-input-${randomUUID()}`);
  const outputPath = path.join(os.tmpdir(), `ai-output-${randomUUID()}.mp3`);
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio for polish: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(inputPath, buffer);

    const duration = await getAudioDuration(inputPath);
    const outFadeStart = Math.max(0, duration - 0.75);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          "loudnorm=I=-16:LRA=11:TP=-1.5",
          "dynaudnorm",
          "afade=t=in:st=0:d=0.3",
          `afade=t=out:st=${outFadeStart}:d=0.5`,
        ])
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(outputPath);
    });

    const relativeKey = `generated/${randomUUID()}.mp3`;
    const destPath = path.join(LOCAL_OBJECTS_DIR, relativeKey);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(outputPath, destPath);

    return {
      url: `/api/internal/uploads/${relativeKey}`,
      duration,
    };
  } finally {
    [inputPath, outputPath].forEach((file) => {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    });
  }
}

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
   * Build a rich, structured prompt from user input + genre intelligence
   * This is the core prompt engineering that makes generations sound good
   */
  private buildRichPrompt(userPrompt: string, options: {
    genre?: string; bpm?: number; key?: string; mood?: string;
    style?: string; vocals?: boolean; type?: string;
    instrument?: string; sections?: string;
  }): { prompt: string; bpm: number; key: string; negativePrompt: string } {
    const { genre = 'pop', mood, style = 'modern', vocals = false, type, instrument, sections } = options;
    const genreSpec = getGenreSpec(genre);
    const bpm = options.bpm || (genreSpec?.bpmRange ? Math.round((genreSpec.bpmRange[0] + genreSpec.bpmRange[1]) / 2) : 120);
    const key = options.key || genreSpec?.preferredKeys?.[0] || 'C minor';
    const genreMood = mood || genreSpec?.mood || 'energetic';
    const instruments = instrument || genreSpec?.instruments?.slice(0, 4).join(', ') || 'synths, drums, bass';
    const bassStyle = genreSpec?.bassStyle || 'punchy bass';
    const drumPattern = genreSpec?.drumPattern || 'driving drums';
    const tips = genreSpec?.productionTips?.[0] || 'professional production';

    // Mix adjectives for quality
    const mixAdj = 'modern mix, fat low-end, crisp highs, wide stereo, professional mastering';
    const vocalTag = vocals ? '' : ', no vocals, instrumental only';

    // Section cues if provided
    const sectionCue = sections ? `, ${sections}` : '';

    const prompt = [
      userPrompt,
      `${genre} ${style}`,
      `${bpm} bpm, ${key}`,
      `${genreMood} mood`,
      instruments,
      `${bassStyle}, ${drumPattern}`,
      tips,
      mixAdj,
      vocalTag,
      sectionCue,
    ].filter(Boolean).join(', ');

    // Negative prompt to reduce mushy/bad outputs
    const negativePrompt = 'low quality, distorted, clipping, noise, hiss, muffled, mono, amateur, off-key, out of tune';

    return { prompt, bpm, key, negativePrompt };
  }

  /**
   * Generate studio-quality audio using provider cascade:
   * 1. Suno API (best quality, if configured)
   * 2. MusicGen Large/Stereo on Replicate (high quality fallback)
   * 3. Stable Audio on Replicate (alternative)
   * 
   * Supports: variations, seed control, melody conditioning, section stitching
   */
  async generateFullSong(prompt: string, options: {
    genre?: string;
    mood?: string;
    duration?: number;
    style?: string;
    vocals?: boolean;
    bpm?: number;
    key?: string;
    seed?: number;
    variations?: number;
    sections?: string;
    melodyUrl?: string;
    aiProvider?: string;
  }): Promise<any> {
    const {
      genre = "pop",
      mood = "uplifting",
      duration = 30,
      style = "modern",
      vocals = true,
      bpm,
      key,
      seed,
      variations = 1,
      sections,
      melodyUrl,
      aiProvider,
    } = options;

    console.log('🎵 UnifiedMusic: Generating full song with multi-provider cascade...');

    const rich = this.buildRichPrompt(prompt, { genre, bpm, key, mood, style, vocals, sections });
    console.log(`🧠 Rich prompt: ${rich.prompt.substring(0, 120)}...`);
    const providerPreference = String(aiProvider || '').toLowerCase();

    const trySuno = async () => {
      const { sunoApiService } = await import('./sunoApiService');
      if (!sunoApiService.isConfigured()) {
        throw new Error('Suno provider requested but not configured');
      }

      if (vocals) {
        const result = await sunoApiService.generateSong(rich.prompt, style, `${genre} Song`);
        return {
          status: 'success',
          audio_url: result.audioUrl,
          metadata: { duration: result.duration, quality: '48kHz stereo', generator: 'suno', genre, bpm: rich.bpm, key: rich.key }
        };
      }

      const result = await sunoApiService.generateBeat(style, rich.bpm, rich.key);
      return {
        status: 'success',
        audio_url: result.audioUrl,
        metadata: { duration: result.duration, quality: '48kHz stereo', generator: 'suno', genre, bpm: rich.bpm, key: rich.key }
      };
    };

    const tryMusicGenLarge = async () => {
      return this.generateWithMusicGenLarge(rich.prompt, {
        duration: Math.min(duration, 30),
        seed,
        variations,
        melodyUrl,
      });
    };

    if (providerPreference === 'suno' || providerPreference === 'replicate-suno') {
      try {
        console.log('🎵 Requested provider: Suno');
        return await trySuno();
      } catch (sunoErr: any) {
        console.warn('⚠️ Requested Suno failed, continuing fallback cascade:', sunoErr?.message || sunoErr);
      }
    }

    if (providerPreference === 'replicate-musicgen') {
      try {
        console.log('🎵 Requested provider: MusicGen Large (Replicate)');
        return await tryMusicGenLarge();
      } catch (mgErr: any) {
        console.warn('⚠️ Requested MusicGen failed, continuing fallback cascade:', mgErr?.message || mgErr);
      }
    }

    // ═══ PROVIDER 1: Suno API (best quality) ═══
    try {
      console.log('🎵 Provider 1: Suno API');
      return await trySuno();
    } catch (sunoErr: any) {
      console.warn('⚠️ Suno API failed, trying next provider:', sunoErr.message);
    }

    // ═══ PROVIDER 2: MusicGen Large/Stereo on Replicate ═══
    try {
      console.log('🎵 Provider 2: MusicGen Large (Replicate)');
      const result = await tryMusicGenLarge();
      return result;
    } catch (mgErr: any) {
      console.warn('⚠️ MusicGen Large failed, trying Stable Audio:', mgErr.message);
    }

    // ═══ PROVIDER 3: Stable Audio ═══
    try {
      console.log('🎵 Provider 3: Stable Audio');
      return await this.generateWithStableAudio(rich.prompt, {
        duration: Math.min(duration, 47),
        genre, bpm: rich.bpm, key: rich.key,
        negative_prompt: rich.negativePrompt,
      });
    } catch (saErr: any) {
      console.warn('⚠️ Stable Audio failed, using basic MusicGen:', saErr.message);
    }

    // ═══ PROVIDER 4: Basic MusicGen (last resort) ═══
    return this.generateTrack(rich.prompt, { type: 'instrumental', duration, genre, bpm: rich.bpm, key: rich.key });
  }

  /**
   * MusicGen Large / Stereo — high quality Replicate generation
   * Uses the large model with proper sampling params from the model card
   */
  async generateWithMusicGenLarge(prompt: string, options: {
    duration?: number;
    seed?: number;
    variations?: number;
    melodyUrl?: string | null;
  } = {}): Promise<any> {
    const { duration = 30, seed, variations = 1, melodyUrl } = options;
    const actualSeed = seed ?? Math.floor(Math.random() * 2147483647);

    console.log(`🎵 MusicGen Large: duration=${duration}s, seed=${actualSeed}, variations=${variations}`);

    // Use melody-large if melody conditioning is provided, otherwise stereo-large
    const modelId = melodyUrl
      ? "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135571e41c36ba2865ab1c3dfc28e1e4e8463" // melody-large
      : "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043ac92924f66e7e4c19447d8b35"; // stereo-large

    const input: Record<string, any> = {
      prompt,
      duration: Math.min(duration, 30),
      model_version: "stereo-large",
      output_format: "wav",
      seed: actualSeed,
      top_k: 250,
      top_p: 0.97,
      temperature: 1.0,
      classifier_free_guidance: 3.5,
      normalization_strategy: "loudness",
    };

    if (melodyUrl) {
      input.input_audio = melodyUrl;
      input.model_version = "melody-large";
      input.continuation = false;
    }

    // Generate multiple variations if requested
    if (variations > 1) {
      console.log(`🎵 Generating ${variations} variations...`);
      const results: any[] = [];
      for (let i = 0; i < Math.min(variations, 4); i++) {
        input.seed = actualSeed + i * 1000;
        const output = await replicate.run(modelId as any, { input: { ...input } });
        results.push({
          audio_url: output,
          seed: input.seed,
          variation: i + 1,
        });
      }
      return {
        status: 'success',
        audio_url: results[0].audio_url, // Primary result
        variations: results,
        metadata: {
          duration,
          quality: '32kHz stereo',
          generator: 'musicgen-large',
          model: melodyUrl ? 'melody-large' : 'stereo-large',
          seed: actualSeed,
          variationCount: results.length,
        }
      };
    }

    const output = await replicate.run(modelId as any, { input });
    return {
      status: 'success',
      audio_url: output,
      metadata: {
        duration,
        quality: '32kHz stereo',
        generator: 'musicgen-large',
        model: melodyUrl ? 'melody-large' : 'stereo-large',
        seed: actualSeed,
      }
    };
  }

  /**
   * Generate a full song by stitching sections (verse, hook, bridge)
   * Each section is generated separately then concatenated server-side
   */
  async generateStitchedSong(prompt: string, options: {
    genre?: string; bpm?: number; key?: string; mood?: string;
    vocals?: boolean; seed?: number;
    structure?: Array<{ name: string; duration: number; energy: string }>;
  }): Promise<any> {
    const { genre = 'pop', bpm, key, mood, vocals = false, seed } = options;
    const baseSeed = seed ?? Math.floor(Math.random() * 2147483647);

    // Default song structure if none provided
    const structure = options.structure || [
      { name: 'intro', duration: 10, energy: 'low' },
      { name: 'verse', duration: 20, energy: 'medium' },
      { name: 'hook', duration: 15, energy: 'high' },
      { name: 'verse2', duration: 20, energy: 'medium' },
      { name: 'hook2', duration: 15, energy: 'high' },
      { name: 'outro', duration: 10, energy: 'low' },
    ];

    console.log(`🎵 Stitched Song: ${structure.length} sections, seed=${baseSeed}`);

    const sectionResults: any[] = [];

    for (let i = 0; i < structure.length; i++) {
      const section = structure[i];
      const energyAdj = section.energy === 'high' ? 'energetic, full arrangement, maximum impact'
        : section.energy === 'low' ? 'sparse, atmospheric, minimal'
        : 'balanced, groovy, steady';

      const sectionPrompt = this.buildRichPrompt(
        `${prompt}. ${section.name} section: ${energyAdj}`,
        { genre, bpm, key, mood, vocals, sections: `${section.name} section` }
      );

      try {
        const result = await this.generateWithMusicGenLarge(sectionPrompt.prompt, {
          duration: Math.min(section.duration, 30),
          seed: baseSeed + i * 10000, // Related seeds for coherence
        });
        sectionResults.push({
          ...result,
          section: section.name,
          sectionIndex: i,
        });
      } catch (err: any) {
        console.warn(`⚠️ Section "${section.name}" failed:`, err.message);
      }
    }

    if (sectionResults.length === 0) {
      throw new Error('All section generations failed');
    }

    return {
      status: 'success',
      audio_url: sectionResults[0].audio_url, // First section as primary
      sections: sectionResults,
      metadata: {
        generator: 'musicgen-stitched',
        sectionCount: sectionResults.length,
        totalDuration: structure.reduce((sum, s) => sum + s.duration, 0),
        seed: baseSeed,
      }
    };
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
        // Use MusicGen Large with optimized sampling params
        const randomSeed = Math.floor(Math.random() * 2147483647);
        const mixAdj = 'modern mix, fat low-end, crisp highs, wide stereo';
        const variedPrompt = `${fullPrompt}. ${mixAdj}.`;
        
        const output = await replicate.run(
          "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043ac92924f66e7e4c19447d8b35",
          {
            input: {
              prompt: variedPrompt,
              duration: Math.min(duration, 30),
              model_version: "stereo-large",
              output_format: "wav",
              temperature: 1.0,
              top_k: 250,
              top_p: 0.97,
              classifier_free_guidance: 3.5,
              normalization_strategy: "loudness",
              seed: randomSeed
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
   * Generate with Stable Audio 2.0 - Better quality instrumentals with more variety
   * Use this for higher quality, more diverse instrumental generation
   */
  async generateWithStableAudio(prompt: string, options: {
    duration?: number;
    genre?: string;
    bpm?: number;
    key?: string;
    negative_prompt?: string;
  } = {}): Promise<any> {
    const { duration = 30, genre = 'electronic', bpm, key, negative_prompt } = options;
    
    console.log(`🎵 UnifiedMusic: Using Stable Audio 2.0 for "${prompt}"`);
    
    // Get genre intelligence
    const genreSpec = getGenreSpec(genre);
    const smartBpm = bpm || (genreSpec?.bpmRange ? Math.round((genreSpec.bpmRange[0] + genreSpec.bpmRange[1]) / 2) : 120);
    const smartInstruments = genreSpec?.instruments?.slice(0, 3).join(', ') || 'synths, drums, bass';
    
    // Build rich prompt for Stable Audio
    const fullPrompt = `${genre} instrumental track, ${smartBpm} BPM, ${key || 'C major'}. ${smartInstruments}. ${prompt}. High quality, professional production, clear mix.`;
    
    try {
      const output = await replicate.run(
        "stability-ai/stable-audio-open-1.0:a493f1e6e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5" as any,
        {
          input: {
            prompt: fullPrompt,
            seconds_total: Math.min(duration, 47),
            steps: 100,
            cfg_scale: 7,
            seed: Math.floor(Math.random() * 2147483647),
            sampler: "dpmpp-3m-sde",
            sigma_min: 0.3,
            sigma_max: 500,
            ...(negative_prompt && { negative_prompt })
          }
        }
      );

      return {
        status: 'success',
        audio_url: output,
        metadata: {
          type: 'instrumental',
          duration,
          generator: 'stable-audio',
          genre,
          bpm: smartBpm,
          key
        }
      };
    } catch (error) {
      console.warn('Stable Audio failed, falling back to MusicGen:', error);
      // Fallback to MusicGen
      return this.generateTrack(prompt, { type: 'instrumental', duration, genre, bpm, key });
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

          // Detect genre and key from prompt for accurate metadata
          const detectedGenre = this.detectGenreFromPrompt(prompt);
          const detectedKey = this.pickKeyForGenre(detectedGenre);

          packs.push({
            id: `pack_${randomUUID()}`,
            title: `${prompt} AI Pack ${i + 1}`,
            description: `AI generated ${detectedGenre.toLowerCase()} loop pack: ${variation}`,
            bpm,
            key: detectedKey,
            genre: detectedGenre,
            samples,
            metadata: {
              energy: 0.8,
              mood: variation,
              instruments: ['mixed'],
              tags: ['ai', 'replicate', detectedGenre.toLowerCase()]
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

  private detectGenreFromPrompt(prompt: string): string {
    const p = prompt.toLowerCase();
    const genrePatterns: [string, string][] = [
      ['drum and bass', 'Drum & Bass'], ['drum & bass', 'Drum & Bass'], ['dnb', 'Drum & Bass'],
      ['deep house', 'Deep House'], ['boom bap', 'Boom Bap'],
      ['hip hop', 'Hip Hop'], ['hiphop', 'Hip Hop'],
      ['trap', 'Trap'], ['drill', 'Drill'],
      ['house', 'House'], ['techno', 'Techno'],
      ['ambient', 'Ambient'], ['lo-fi', 'Lo-Fi'], ['lofi', 'Lo-Fi'],
      ['jazz', 'Jazz'], ['rock', 'Rock'], ['pop', 'Pop'],
      ['r&b', 'R&B'], ['rnb', 'R&B'], ['soul', 'Soul'],
      ['country', 'Country'], ['reggae', 'Reggae'], ['reggaeton', 'Reggaeton'],
      ['funk', 'Funk'], ['afrobeat', 'Afrobeat'], ['latin', 'Latin'],
      ['dubstep', 'Dubstep'], ['edm', 'EDM'],
    ];
    for (const [pattern, name] of genrePatterns) {
      if (p.includes(pattern)) return name;
    }
    return 'Electronic';
  }

  private pickKeyForGenre(genre: string): string {
    const keyMap: Record<string, string[]> = {
      'Hip Hop': ['Cm', 'Fm', 'Gm', 'Am'],
      'Boom Bap': ['Am', 'Dm', 'Em', 'Cm'],
      'Trap': ['Cm', 'F#m', 'Am', 'Dm'],
      'Drill': ['Cm', 'Gm', 'Fm', 'Bbm'],
      'House': ['Am', 'Dm', 'Em', 'Gm'],
      'Deep House': ['Am', 'Dm', 'Cm', 'Fm'],
      'Techno': ['Am', 'Fm', 'Cm', 'Gm'],
      'Lo-Fi': ['C', 'Am', 'F', 'Dm'],
      'Jazz': ['Dm', 'G', 'C', 'Am'],
      'Ambient': ['C', 'Am', 'Em', 'Dm'],
      'Rock': ['E', 'A', 'D', 'G'],
      'Pop': ['C', 'G', 'Am', 'F'],
      'R&B': ['Dm', 'Gm', 'Am', 'Cm'],
      'Soul': ['Dm', 'Am', 'Gm', 'Cm'],
      'Country': ['G', 'C', 'D', 'A'],
      'Reggae': ['Am', 'Dm', 'Em', 'G'],
      'Reggaeton': ['Am', 'Dm', 'Gm', 'Cm'],
      'Funk': ['Em', 'Am', 'Dm', 'Gm'],
      'Afrobeat': ['Am', 'Dm', 'Em', 'Gm'],
      'Latin': ['Am', 'Dm', 'Em', 'G'],
      'Drum & Bass': ['Am', 'Fm', 'Cm', 'Dm'],
      'Dubstep': ['Fm', 'Cm', 'Gm', 'Dm'],
      'EDM': ['Am', 'Dm', 'Fm', 'Cm'],
      'Electronic': ['Am', 'Dm', 'Fm', 'C'],
    };
    const keys = keyMap[genre] || keyMap['Electronic'];
    const hash = genre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return keys[hash % keys.length];
  }

  // Helper for direct raw access if needed
  async rawReplicateCall(model: string, input: any): Promise<any> {
    return await replicate.run(model as any, { input });
  }
}

export const unifiedMusicService = new UnifiedMusicService();
