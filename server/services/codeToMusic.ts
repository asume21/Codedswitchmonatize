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
import { enhanceCodeToMusic, isAIAvailable } from './codeToMusic/aiEnhancer';

/**
 * Main entry point: Convert code to music
 */
export async function convertCodeToMusic(
  request: CodeToMusicRequest
): Promise<CodeToMusicResponse> {
  try {
    const useAI = request.useAI && isAIAvailable();
    
    console.log('🎵 Code-to-Music: Starting conversion', {
      language: request.language,
      genre: request.genre,
      variation: request.variation,
      codeLength: request.code.length,
      useAI,
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
    
    let timeline: any[] = [];
    let chords: any[] = [];
    let melody: any[] = [];
    let drums: any = null;
    let aiEnhanced = false;
    
    // Try AI-enhanced generation if requested
    if (useAI) {
      console.log('🤖 Attempting AI-enhanced music generation...');
      const aiResult = await enhanceCodeToMusic(parsedCode, genreConfig.name, bpm, request.variation);
      
      if (aiResult) {
        aiEnhanced = true;
        console.log('✅ AI enhancement successful!');
        
        // Convert AI chords to our format
        chords = aiResult.chords.map(c => ({
          chord: c.chord,
          notes: chordToNotes(c.chord),
          start: c.start,
          duration: c.duration,
        }));
        
        // Convert AI melody to our format
        melody = aiResult.melody.map(m => ({
          note: `${m.note}${m.octave}`,
          start: m.start,
          duration: m.duration,
          velocity: Math.round((m.velocity || 0.8) * 127),
          instrument: 'synth',
          source: 'ai-generated',
        }));
        
        // Build timeline from AI-generated elements
        timeline = [
          ...chords.map(c => ({ time: c.start, type: 'chord', data: c })),
          ...melody.map(m => ({ time: m.start, type: 'note', data: m })),
        ].sort((a, b) => a.time - b.time);
        
        // Use algorithmic drums (AI focus is on harmony/melody)
        drums = generateDrumPattern(parsedCode, bpm);
      } else {
        console.log('⚠️ AI enhancement failed, falling back to algorithmic');
      }
    }
    
    // Fallback to algorithmic generation
    if (!aiEnhanced) {
      const generated = generateTimeline(
        parsedCode,
        genreConfig.name,
        bpm,
        request.variation
      );
      timeline = generated.timeline;
      chords = generated.chords;
      melody = generated.melody;
      drums = generateDrumPattern(parsedCode, bpm);
    }
    
    // Calculate total duration
    const duration = melody.length > 0 
      ? Math.max(...melody.map((n: any) => n.start + n.duration))
      : 16;
    
    console.log('🎼 Generated music:', {
      timelineEvents: timeline.length,
      chords: chords.length,
      melodyNotes: melody.length,
      duration: `${duration.toFixed(1)}s`,
      bpm,
      aiEnhanced,
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
        aiEnhanced,
      } as any,
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
 * Convert chord symbol to array of note names (e.g., "Cmaj7" -> ["C4", "E4", "G4", "B4"])
 */
function chordToNotes(chordSymbol: string): string[] {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Parse root note (preserve original casing for root)
  const rootMatch = chordSymbol.match(/^([A-G][#b]?)/i);
  if (!rootMatch) return ['C4', 'E4', 'G4'];
  
  const root = rootMatch[1].charAt(0).toUpperCase() + rootMatch[1].slice(1);
  const rootMidi = noteMap[root] ?? 0;
  const quality = chordSymbol.slice(root.length); // Keep original casing for quality parsing
  const qualityLower = quality.toLowerCase();
  
  // Determine intervals based on chord quality
  let intervals = [0, 4, 7]; // Major triad default
  
  // Check for minor (but not maj7/maj9 etc)
  const isMinor = (qualityLower.includes('m') || qualityLower.includes('min')) && 
                  !qualityLower.includes('maj') && !qualityLower.includes('dim');
  
  if (isMinor) {
    intervals = [0, 3, 7]; // Minor
  }
  if (qualityLower.includes('dim')) {
    intervals = [0, 3, 6]; // Diminished
  }
  if (qualityLower.includes('aug') || quality.includes('+')) {
    intervals = [0, 4, 8]; // Augmented
  }
  
  // Handle sus chords (must check before 7ths)
  if (qualityLower.includes('sus4')) {
    intervals = [0, 5, 7]; // Sus4
  } else if (qualityLower.includes('sus2')) {
    intervals = [0, 2, 7]; // Sus2
  }
  
  // Handle 7th chords (skip add-chords which don't include 7th)
  const isAddChord = qualityLower.includes('add');
  const has7thExtension = qualityLower.includes('7') || 
                          (qualityLower.includes('9') && !isAddChord) || 
                          (qualityLower.includes('11') && !isAddChord) || 
                          (qualityLower.includes('13') && !isAddChord);
  
  if (has7thExtension) {
    if (qualityLower.includes('maj7') || qualityLower.includes('maj9') || qualityLower.includes('maj11') || qualityLower.includes('maj13')) {
      // Major 7th
      if (!intervals.includes(11)) intervals.push(11);
    } else if (isMinor) {
      // Minor 7th
      if (!intervals.includes(10)) intervals.push(10);
    } else if (qualityLower.includes('dim7')) {
      // Diminished 7th
      if (!intervals.includes(9)) intervals.push(9);
    } else {
      // Dominant 7th
      if (!intervals.includes(10)) intervals.push(10);
    }
  }
  
  // Handle extensions
  if (qualityLower.includes('9')) {
    if (!intervals.includes(14)) intervals.push(14); // Add 9th
  }
  if (qualityLower.includes('11')) {
    if (!intervals.includes(14)) intervals.push(14); // 9th implied
    if (!intervals.includes(17)) intervals.push(17); // Add 11th
  }
  if (qualityLower.includes('13')) {
    if (!intervals.includes(14)) intervals.push(14); // 9th implied
    if (!intervals.includes(21)) intervals.push(21); // Add 13th
  }
  
  // Handle add chords
  if (qualityLower.includes('add9') && !intervals.includes(14)) {
    intervals.push(14);
  }
  if (qualityLower.includes('add11') && !intervals.includes(17)) {
    intervals.push(17);
  }
  
  // Convert to note names in octave 4
  return intervals.map(interval => {
    const noteIndex = (rootMidi + interval) % 12;
    const octave = 4 + Math.floor((rootMidi + interval) / 12);
    return `${noteNames[noteIndex]}${octave}`;
  });
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
    const useAI = request.useAI && isAIAvailable();
    
    console.log('🎵 Enhanced Code-to-Music: Starting conversion', {
      language: request.language,
      genre: request.genre,
      variation: request.variation,
      codeLength: request.code.length,
      useAI,
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
    
    // Try AI-enhanced generation if requested and available
    if (useAI) {
      console.log('🤖 Attempting AI-enhanced music generation...');
      const aiResult = await enhanceCodeToMusic(parsedCode, genreConfig.name, bpm, request.variation);
      
      if (aiResult) {
        console.log('✅ AI enhancement successful!');
        
        // Convert AI chords to our format
        const chords = aiResult.chords.map(c => ({
          chord: c.chord,
          notes: chordToNotes(c.chord),
          start: c.start,
          duration: c.duration,
        }));
        
        // Convert AI melody to our format
        const melody = aiResult.melody.map(m => ({
          note: `${m.note}${m.octave}`,
          start: m.start,
          duration: m.duration,
          velocity: Math.round((m.velocity || 0.8) * 127),
          instrument: 'synth',
          source: 'ai-generated',
        }));
        
        // Convert AI bassline to our format
        const bass = (aiResult.bassline || []).map(b => ({
          note: `${b.note}${b.octave}`,
          start: b.start,
          duration: b.duration,
          velocity: 100,
          instrument: 'bass',
          source: 'ai-generated',
        }));
        
        const allMelody = [...melody, ...bass];
        
        // Calculate duration
        const duration = allMelody.length > 0 
          ? Math.max(...allMelody.map(n => n.start + n.duration))
          : 16;
        
        // Generate drums (still use advanced generator for drums)
        const advancedDrums = generateAdvancedDrumPattern(
          parsedCode,
          genreConfig.name,
          bpm,
          duration
        );
        
        const drumNotes = drumPatternToNotes(advancedDrums);
        
        // Build timeline from AI-generated elements
        const timeline = [
          ...allMelody.map(note => ({
            time: note.start,
            type: 'note' as const,
            data: {
              note: note.note,
              duration: note.duration,
              velocity: note.velocity,
              instrument: note.instrument,
            },
            source: note.source,
          })),
          ...drumNotes.map(drum => ({
            time: drum.start,
            type: 'note' as const,
            data: {
              note: drum.note,
              duration: drum.duration,
              velocity: drum.velocity,
              instrument: drum.instrument,
            },
            source: drum.source,
          })),
        ].sort((a, b) => a.time - b.time);
        
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
            aiEnhanced: true,
          },
        };
        
        console.log('🎼 AI-enhanced music generated:', {
          melodyNotes: melody.length,
          bassNotes: bass.length,
          drumHits: advancedDrums.hits.length,
          duration: `${duration.toFixed(1)}s`,
          bpm,
        });
        
        return {
          success: true,
          music,
          metadata: music.metadata,
        };
      } else {
        console.log('⚠️ AI enhancement failed, falling back to standard generation');
      }
    }
    
    // Standard generation (fallback or when AI not requested)
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
