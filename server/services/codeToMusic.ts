/**
 * Code-to-Music Service
 * Main algorithm for converting code to harmonic music
 */

import type {
  CodeToMusicRequest,
  CodeToMusicResponse,
  MusicData,
  ParsedCode,
} from '../../shared/types/codeToMusic';
import { getGenreConfig, DEFAULT_GENRE } from './codeToMusic/genreConfigs';
import { parseCodeStructure, getCodeStatistics } from './codeToMusic/codeParser';
import { generateTimeline, generateDrumPattern, calculateOptimalBPM } from './codeToMusic/timelineGenerator';
import { generateAdvancedMelody } from './codeToMusic/melodyGenerator';
import { generateAdvancedDrumPattern, drumPatternToNotes } from './codeToMusic/advancedDrums';
import { getChordsForGenre } from './codeToMusic/chordDefinitions';

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

    // Calculate optimal BPM
    const bpm = calculateOptimalBPM(parsedCode, genreConfig.bpm);
    
    // Generate timeline (Step 4 - COMPLETE)
    const { timeline, chords, melody } = generateTimeline(
      parsedCode,
      genreConfig.name,
      bpm,
      request.variation
    );
    
    // Generate drum pattern
    const drums = generateDrumPattern(parsedCode, bpm);
    
    // Calculate total duration
    const duration = melody.length > 0 
      ? Math.max(...melody.map(n => n.start + n.duration))
      : 16;
    
    console.log('🎼 Generated music:', {
      timelineEvents: timeline.length,
      chords: chords.length,
      melodyNotes: melody.length,
      duration: `${duration.toFixed(1)}s`,
      bpm,
    });

    // Complete music data (Step 5 - COMPLETE)
    const music: MusicData = {
      timeline,
      chords,
      melody,
      drums,
      metadata: {
        bpm,
        key: pickKeyForGenre(genreConfig.name, parsedCode.mood || 'neutral'),
        genre: genreConfig.name,
        variation: request.variation,
        duration,
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
 * Pick a key based on genre/mood to avoid everything being C major.
 */
function pickKeyForGenre(genre: string, mood: string): string {
  const keyMap: Record<string, string> = {
    pop: mood === 'sad' ? 'A Minor' : 'C Major',
    rock: 'G Major',
    hiphop: 'A Minor',
    edm: 'D Minor',
    rnb: 'F Major',
    country: 'D Major',
  };
  return keyMap[genre] || 'C Major';
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
 * ENHANCED Code-to-Music conversion with advanced melody and drum generation
 * This version produces more musical, expressive output
 */
export async function convertCodeToMusicEnhanced(
  request: CodeToMusicRequest
): Promise<CodeToMusicResponse> {
  try {
    console.log('🎵 Enhanced Code-to-Music: Starting conversion', {
      language: request.language,
      genre: request.genre,
      variation: request.variation,
      codeLength: request.code.length,
    });

    if (!request.code || request.code.trim().length === 0) {
      return { success: false, error: 'Code cannot be empty' };
    }

    const genreConfig = getGenreConfig(request.genre || DEFAULT_GENRE);
    const parsedCode = parseCodeStructure(request.code, request.language);
    const stats = getCodeStatistics(parsedCode);
    
    console.log('📝 Parsed code:', {
      elements: parsedCode.elements.length,
      complexity: parsedCode.complexity,
      mood: parsedCode.mood,
      stats,
    });

    // Calculate optimal BPM based on code characteristics
    const bpm = calculateOptimalBPM(parsedCode, genreConfig.bpm);
    
    // Generate chord progression first (foundation)
    const { chords } = generateTimeline(parsedCode, genreConfig.name, bpm, request.variation || 0);
    
    // Use ADVANCED melody generator for richer output
    const { melody, bass, pads } = generateAdvancedMelody(
      parsedCode,
      chords,
      genreConfig.name,
      bpm,
      request.variation || 0
    );
    
    // Combine all melodic elements
    const allMelody = [...melody, ...bass, ...pads];
    
    // Calculate duration from all notes
    const duration = allMelody.length > 0 
      ? Math.max(...allMelody.map(n => n.start + n.duration))
      : 16;
    
    // Use ADVANCED drum generator
    const advancedDrums = generateAdvancedDrumPattern(
      parsedCode,
      genreConfig.name,
      bpm,
      duration
    );
    
    // Convert drum hits to melody note format for unified playback
    const drumNotes = drumPatternToNotes(advancedDrums);
    
    // Create timeline events from all elements
    const timeline = allMelody.map((note, index) => ({
      time: note.start,
      type: 'note' as const,
      data: {
        note: note.note,
        duration: note.duration,
        velocity: note.velocity,
        instrument: note.instrument,
      },
      source: note.source,
    }));
    
    // Add drum events to timeline
    drumNotes.forEach(drum => {
      timeline.push({
        time: drum.start,
        type: 'note' as const,
        data: {
          note: drum.note,
          duration: drum.duration,
          velocity: drum.velocity,
          instrument: drum.instrument,
        },
        source: drum.source,
      });
    });
    
    // Sort timeline by time
    timeline.sort((a, b) => a.time - b.time);

    console.log('🎼 Enhanced music generated:', {
      melodyNotes: melody.length,
      bassNotes: bass.length,
      padNotes: pads.length,
      drumHits: advancedDrums.hits.length,
      fills: advancedDrums.fills.length,
      duration: `${duration.toFixed(1)}s`,
      bpm,
    });

    const music: MusicData = {
      timeline,
      chords,
      melody: allMelody,
      drums: advancedDrums.pattern,
      metadata: {
        bpm,
        key: pickKeyForGenre(genreConfig.name, parsedCode.mood || 'neutral'),
        genre: genreConfig.name,
        variation: request.variation,
        duration,
        generatedAt: new Date().toISOString(),
        seed: generateSeed(request.code, request.variation || 0),
      },
    };

    return {
      success: true,
      music,
      metadata: music.metadata,
    };
  } catch (error) {
    console.error('❌ Enhanced Code-to-Music error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
