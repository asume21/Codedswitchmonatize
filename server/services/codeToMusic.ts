/**
 * Code-to-Music Service
 * Main algorithm for converting code to harmonic music
 */

import type {
  CodeToMusicRequest,
  CodeToMusicResponse,
  MusicData,
  ParsedCode,
  CodeElement,
} from '../../shared/types/codeToMusic';
import { getGenreConfig, DEFAULT_GENRE } from './codeToMusic/genreConfigs';
import { parseCodeStructure, getCodeStatistics } from './codeToMusic/codeParser';

/**
 * Main entry point: Convert code to music
 */
export async function convertCodeToMusic(
  request: CodeToMusicRequest
): Promise<CodeToMusicResponse> {
  try {
    console.log('🎵 Code-to-Music: Starting conversion', {
      language: request.language,
      genre: request.genre,
      variation: request.variation,
      codeLength: request.code.length,
    });

    // Validate inputs
    if (!request.code || request.code.trim().length === 0) {
      return {
        success: false,
        error: 'Code cannot be empty',
      };
    }

    // Get genre configuration
    const genreConfig = getGenreConfig(request.genre || DEFAULT_GENRE);
    console.log('🎸 Using genre:', genreConfig.displayName);

    // Parse code structure (Step 3 - COMPLETE)
    const parsedCode = parseCodeStructure(request.code, request.language);
    const stats = getCodeStatistics(parsedCode);
    
    console.log('📝 Parsed code:', {
      elements: parsedCode.elements.length,
      complexity: parsedCode.complexity,
      mood: parsedCode.mood,
      stats,
    });

    // TODO: Step 4 - Generate timeline
    // TODO: Step 5 - Generate music data
    // TODO: Add variation logic

    // Placeholder response for now
    const music: MusicData = {
      timeline: [],
      chords: [],
      melody: [],
      metadata: {
        bpm: genreConfig.bpm,
        key: 'C Major',
        genre: genreConfig.name,
        variation: request.variation,
        duration: 16,
        generatedAt: new Date().toISOString(),
        seed: generateSeed(request.code, request.variation),
      },
    };

    return {
      success: true,
      music,
      metadata: music.metadata,
    };
  } catch (error) {
    console.error('❌ Code-to-Music error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Old parser removed - now using enhanced parser from codeParser.ts

/**
 * Generate deterministic seed for reproducibility
 */
function generateSeed(code: string, variation: number): number {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) + variation;
}

/**
 * Seeded random number generator (for reproducibility)
 */
export function seededRandom(seed: number): () => number {
  let value = seed;
  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Convert our MusicData to AudioEngine-compatible format
 * This ensures seamless integration with existing CodedSwitch audio system
 */
export function convertToAudioEngineFormat(musicData: any) {
  return {
    // Convert melody notes (0-127 velocity → 0-1)
    notes: musicData.melody?.map((note: any) => ({
      note: note.note,
      time: note.start,
      duration: note.duration,
      velocity: note.velocity / 127, // Convert to 0-1 range
      instrument: note.instrument,
    })) || [],
    
    // Drums already compatible
    drums: musicData.drums,
    
    // Chords for harmonic backing
    chords: musicData.chords,
    
    // Metadata
    bpm: musicData.metadata?.bpm || 120,
    key: musicData.metadata?.key || 'C Major',
  };
}

/**
 * Convert to Piano Roll format for editing
 */
export function convertToPianoRollFormat(musicData: any) {
  return musicData.melody?.map((note: any, index: number) => {
    // Parse note (e.g., 'C4' → note='C', octave=4)
    const match = note.note.match(/([A-G]#?)(\d)/);
    if (!match) return null;
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    // Convert time to step (assuming 16 steps per 4 seconds)
    const step = Math.floor((note.start / 4) * 16);
    
    return {
      id: `note-${index}`,
      step: step % 16, // Keep within 16 steps
      note: noteName,
      octave: octave,
      velocity: note.velocity,
      length: Math.max(1, Math.ceil((note.duration / 4) * 16)),
    };
  }).filter(Boolean) || [];
}
