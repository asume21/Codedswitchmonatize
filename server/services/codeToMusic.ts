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

    // TODO: Step 3 - Parse code structure
    const parsedCode = parseCodeStructure(request.code, request.language);
    console.log('📝 Parsed code:', {
      elements: parsedCode.elements.length,
      complexity: parsedCode.complexity,
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

/**
 * Parse code structure (Step 3)
 * Extracts classes, functions, variables, loops, etc.
 */
function parseCodeStructure(code: string, language: string): ParsedCode {
  // TODO: Implement proper parsing in Step 3
  // For now, return basic structure
  
  const lines = code.split('\n');
  const elements: CodeElement[] = [];

  // Simple regex-based detection (will be improved in Step 3)
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('class ')) {
      elements.push({
        type: 'class',
        name: extractName(trimmed, 'class'),
        line: index + 1,
        content: trimmed,
        nestingLevel: 0,
      });
    } else if (trimmed.startsWith('def ') || trimmed.startsWith('function ')) {
      elements.push({
        type: 'function',
        name: extractName(trimmed, 'function'),
        line: index + 1,
        content: trimmed,
        nestingLevel: 1,
      });
    } else if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
      elements.push({
        type: 'loop',
        name: 'loop',
        line: index + 1,
        content: trimmed,
        nestingLevel: 2,
      });
    }
  });

  return {
    elements,
    language,
    totalLines: lines.length,
    complexity: Math.min(10, Math.floor(elements.length / 2) + 3),
    mood: 'neutral',
  };
}

/**
 * Extract name from code line
 */
function extractName(line: string, type: string): string {
  if (type === 'class') {
    const match = line.match(/class\s+(\w+)/);
    return match ? match[1] : 'Unknown';
  }
  if (type === 'function') {
    const match = line.match(/(?:def|function)\s+(\w+)/);
    return match ? match[1] : 'Unknown';
  }
  return 'Unknown';
}

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
