// server/ai/safety/aiSafeguards.ts
// Comprehensive failsafe system to prevent AI from losing context or producing invalid output

import { genreDatabase, getGenreSpec } from '../knowledge/genreDatabase';

export interface AIOutput {
  bpm?: number;
  key?: string;
  chords?: any[];
  melody?: any[];
  drums?: any[];
  bass?: any[];
  genre?: string;
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedOutput?: AIOutput;
}

export interface SafetyConfig {
  maxBPM: number;
  minBPM: number;
  allowedKeys: string[];
  maxPromptLength: number;
  maxRetries: number;
  fallbackEnabled: boolean;
}

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxBPM: 200,
  minBPM: 40,
  allowedKeys: ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
                'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
                'Cmaj', 'Dmaj', 'Emaj', 'Fmaj', 'Gmaj', 'Amaj', 'Bmaj'],
  maxPromptLength: 10000,
  maxRetries: 3,
  fallbackEnabled: true
};

/**
 * Validate AI output for correctness and safety
 */
const MAX_SEQUENCE_STEPS = 64;

export function validateAIOutput(output: any, genre?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitizedOutput: AIOutput = { ...output };

  // 1. Check if output exists
  if (!output || typeof output !== 'object') {
    errors.push('AI output is null or not an object');
    return { isValid: false, errors, warnings };
  }

  // 2. Validate BPM
  if (output.bpm !== undefined) {
    if (typeof output.bpm !== 'number' || isNaN(output.bpm)) {
      errors.push(`Invalid BPM: ${output.bpm} is not a number`);
    } else if (output.bpm < DEFAULT_SAFETY_CONFIG.minBPM || output.bpm > DEFAULT_SAFETY_CONFIG.maxBPM) {
      warnings.push(`BPM ${output.bpm} is outside normal range (${DEFAULT_SAFETY_CONFIG.minBPM}-${DEFAULT_SAFETY_CONFIG.maxBPM})`);
      // Clamp BPM to safe range
      sanitizedOutput.bpm = Math.max(DEFAULT_SAFETY_CONFIG.minBPM, Math.min(DEFAULT_SAFETY_CONFIG.maxBPM, output.bpm));
    }

    // Validate BPM against genre if provided
    if (genre) {
      const genreSpec = getGenreSpec(genre);
      if (genreSpec && output.bpm) {
        const [minBPM, maxBPM] = genreSpec.bpmRange;
        if (output.bpm < minBPM - 10 || output.bpm > maxBPM + 10) {
          warnings.push(`BPM ${output.bpm} is unusual for ${genre} (expected ${minBPM}-${maxBPM})`);
        }
      }
    }
  }

  // 3. Validate Key
  if (output.key !== undefined) {
    if (typeof output.key !== 'string') {
      errors.push(`Invalid key: ${output.key} is not a string`);
    } else if (!DEFAULT_SAFETY_CONFIG.allowedKeys.includes(output.key)) {
      warnings.push(`Unusual key: ${output.key}`);
      // Try to fix common mistakes
      const normalized = normalizeKey(output.key);
      if (normalized && DEFAULT_SAFETY_CONFIG.allowedKeys.includes(normalized)) {
        sanitizedOutput.key = normalized;
        warnings.push(`Auto-corrected key from ${output.key} to ${normalized}`);
      }
    }
  }

  // 4. Validate Arrays (chords, melody, drums, bass)
  const sequenceValidations: SequenceValidationConfig[] = [
    { field: 'drums', minItems: 4, requireType: true },
    { field: 'bass', minItems: 2, requireNote: true, requireDuration: true },
    { field: 'chords', minItems: 2, requireNotesArray: true, requireDuration: true },
    { field: 'melody', minItems: 2, requireNote: true, requireDuration: true },
  ];

  sequenceValidations.forEach((config) => {
    const rawValue = (output as any)?.[config.field];
    const { events, errors: seqErrors, warnings: seqWarnings } = sanitizeSequenceEvents(
      config.field,
      rawValue,
      config,
    );

    if (seqErrors.length) {
      errors.push(...seqErrors);
    }
    if (seqWarnings.length) {
      warnings.push(...seqWarnings);
    }

    if (Array.isArray(events)) {
      (sanitizedOutput as any)[config.field] = events;
    }
  });

  // 5. Check for unexpected fields (AI hallucination detection)
  const expectedFields = ['bpm', 'key', 'chords', 'melody', 'drums', 'bass', 'genre', 'style', 'mood', 'instruments'];
  const unexpectedFields = Object.keys(output).filter(key => !expectedFields.includes(key));
  if (unexpectedFields.length > 0) {
    warnings.push(`Unexpected fields in output: ${unexpectedFields.join(', ')}`);
  }

  // 6. Validate genre consistency
  if (genre && output.genre && output.genre !== genre) {
    warnings.push(`AI returned different genre: requested ${genre}, got ${output.genre}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedOutput: errors.length === 0 ? sanitizedOutput : undefined
  };
}

/**
 * Normalize key notation (fix common AI mistakes)
 */
function normalizeKey(key: string): string | null {
  const normalized = key.trim().replace(/\s+/g, '');
  
  // Common mistakes
  const corrections: Record<string, string> = {
    'Cminor': 'Cm',
    'Cmajor': 'Cmaj',
    'C-minor': 'Cm',
    'C-major': 'Cmaj',
    'c': 'C',
    'cm': 'Cm',
    'C-flat': 'B',
    'E-sharp': 'F',
    'B-sharp': 'C',
    'F-flat': 'E'
  };

  return corrections[normalized] || normalized;
}

/**
 * Sanitize user prompt to prevent prompt injection
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    return '';
  }

  // Remove excessive length
  let sanitized = prompt.slice(0, DEFAULT_SAFETY_CONFIG.maxPromptLength);

  // Remove potential prompt injection attempts
  const dangerousPatterns = [
    /ignore\s+previous\s+instructions/gi,
    /disregard\s+all\s+prior/gi,
    /forget\s+everything/gi,
    /new\s+instructions:/gi,
    /system\s+prompt:/gi,
    /you\s+are\s+now/gi
  ];

  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove excessive special characters
  sanitized = sanitized.replace(/[^\w\s\-.,!?'"()]/g, '');

  return sanitized.trim();
}

/**
 * Fallback generator - returns safe default output when AI fails
 */
export function generateFallbackOutput(genre?: string): AIOutput {
  const genreSpec = genre ? getGenreSpec(genre) : null;

  return {
    bpm: genreSpec ? genreSpec.bpmRange[0] : 120,
    key: genreSpec ? genreSpec.preferredKeys[0] : 'C',
    chords: [
      { note: 'C', type: 'major', duration: 4 },
      { note: 'G', type: 'major', duration: 4 },
      { note: 'Am', type: 'minor', duration: 4 },
      { note: 'F', type: 'major', duration: 4 }
    ],
    melody: [],
    drums: [],
    bass: [],
    genre: genre || 'pop',
    _fallback: true
  };
}

/**
 * Safe AI wrapper with retry logic and fallback
 */
export async function safeAIGeneration<T>(
  aiFunction: () => Promise<T>,
  validator: (output: T) => ValidationResult,
  fallbackGenerator: () => T,
  config: Partial<SafetyConfig> = {}
): Promise<{ output: T; usedFallback: boolean; attempts: number; warnings: string[] }> {
  const safetyConfig = { ...DEFAULT_SAFETY_CONFIG, ...config };
  let attempts = 0;
  const allWarnings: string[] = [];

  while (attempts < safetyConfig.maxRetries) {
    attempts++;

    try {
      // Attempt AI generation
      const output = await aiFunction();

      // Validate output
      const validation = validator(output);
      allWarnings.push(...validation.warnings);

      if (validation.isValid && validation.sanitizedOutput) {
        return {
          output: validation.sanitizedOutput as T,
          usedFallback: false,
          attempts,
          warnings: allWarnings
        };
      }

      // Log errors for debugging
      console.warn(`AI generation attempt ${attempts} failed validation:`, validation.errors);

      // If last attempt and fallback enabled, use fallback
      if (attempts === safetyConfig.maxRetries && safetyConfig.fallbackEnabled) {
        console.warn('All AI attempts failed, using fallback');
        return {
          output: fallbackGenerator(),
          usedFallback: true,
          attempts,
          warnings: [...allWarnings, 'Used fallback due to AI failures']
        };
      }

    } catch (error) {
      console.error(`AI generation attempt ${attempts} threw error:`, error);

      // If last attempt and fallback enabled, use fallback
      if (attempts === safetyConfig.maxRetries && safetyConfig.fallbackEnabled) {
        console.warn('All AI attempts failed with errors, using fallback');
        return {
          output: fallbackGenerator(),
          usedFallback: true,
          attempts,
          warnings: [...allWarnings, `Used fallback due to errors: ${error}`]
        };
      }
    }

    // Wait before retry (exponential backoff)
    if (attempts < safetyConfig.maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  // Should never reach here, but just in case
  console.error('AI generation failed all attempts and fallback is disabled');
  throw new Error('AI generation failed after all retry attempts');
}

/**
 * Context preservation - ensure AI remembers important details
 */
export interface AIContext {
  genre?: string;
  bpm?: number;
  key?: string;
  mood?: string;
  previousOutputs?: AIOutput[];
  userPreferences?: Record<string, any>;
}

export function preserveContext(context: AIContext, newOutput: AIOutput): AIContext {
  return {
    ...context,
    previousOutputs: [
      ...(context.previousOutputs || []).slice(-5), // Keep last 5 outputs
      newOutput
    ]
  };
}

export function buildContextualPrompt(basePrompt: string, context: AIContext): string {
  let prompt = basePrompt;

  if (context.genre) {
    prompt = `Genre: ${context.genre}\n${prompt}`;
  }

  if (context.bpm) {
    prompt = `BPM: ${context.bpm}\n${prompt}`;
  }

  if (context.key) {
    prompt = `Key: ${context.key}\n${prompt}`;
  }

  if (context.mood) {
    prompt = `Mood: ${context.mood}\n${prompt}`;
  }

  if (context.previousOutputs && context.previousOutputs.length > 0) {
    prompt = `Previous generation context: ${JSON.stringify(context.previousOutputs[context.previousOutputs.length - 1])}\n${prompt}`;
  }

  return prompt;
}

/**
 * Output quality scoring
 */
export function scoreOutputQuality(output: AIOutput, genre?: string): number {
  let score = 100;

  // Deduct points for missing expected fields
  if (!output.bpm) score -= 10;
  if (!output.key) score -= 10;
  if (!output.chords || output.chords.length === 0) score -= 20;

  // Deduct points for genre mismatch
  if (genre) {
    const genreSpec = getGenreSpec(genre);
    if (genreSpec && output.bpm) {
      const [minBPM, maxBPM] = genreSpec.bpmRange;
      if (output.bpm < minBPM - 20 || output.bpm > maxBPM + 20) {
        score -= 15;
      }
    }
  }

  // Deduct points for using fallback
  if (output._fallback) {
    score -= 30;
  }

  return Math.max(0, score);
}

/**
 * Emergency stop - detect if AI is behaving erratically
 */
export function detectErraticBehavior(outputs: AIOutput[]): boolean {
  if (outputs.length < 3) return false;

  // Check for wild BPM swings
  const bpms = outputs.map(o => o.bpm).filter(Boolean) as number[];
  if (bpms.length >= 3) {
    const bpmVariance = Math.max(...bpms) - Math.min(...bpms);
    if (bpmVariance > 100) {
      console.warn('Erratic behavior detected: Wild BPM swings');
      return true;
    }
  }

  // Check for genre inconsistency
  const genres = outputs.map(o => o.genre).filter(Boolean);
  const uniqueGenres = new Set(genres);
  if (genres.length >= 3 && uniqueGenres.size === genres.length) {
    console.warn('Erratic behavior detected: Genre inconsistency');
    return true;
  }

  return false;
}

interface SequenceValidationConfig {
  field: 'drums' | 'bass' | 'chords' | 'melody';
  minItems?: number;
  maxStep?: number;
  requireDuration?: boolean;
  requireNote?: boolean;
  requireNotesArray?: boolean;
  requireType?: boolean;
}

interface SequenceValidationResult {
  events: any[];
  errors: string[];
  warnings: string[];
}

function sanitizeSequenceEvents(
  field: SequenceValidationConfig['field'],
  value: any,
  config: SequenceValidationConfig,
): SequenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value === undefined) {
    errors.push(`${field} data is missing`);
    return { events: [], errors, warnings };
  }

  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array, got ${typeof value}`);
    return { events: [], errors, warnings };
  }

  const sanitized: any[] = [];
  const maxStep = config.maxStep ?? MAX_SEQUENCE_STEPS;

  value.forEach((event, index) => {
    const normalized = coerceSequenceEvent(event, field, index, maxStep);
    if (!normalized) {
      warnings.push(`${field}[${index}] is not an object, discarding`);
      return;
    }

    const sanitizedEvent: any = { ...normalized };
    const step = Number(sanitizedEvent.step);
    sanitizedEvent.step = Number.isFinite(step) && step >= 0 && step < maxStep
      ? Math.floor(step)
      : defaultStepForIndex(index, maxStep);

    if (config.requireDuration) {
      const duration = Number(sanitizedEvent.duration);
      sanitizedEvent.duration = Number.isFinite(duration) && duration > 0
        ? duration
        : defaultDurationForField(field);
    }

    if (config.requireNote) {
      const note = deriveNoteValue(sanitizedEvent.note);
      if (note === null) {
        warnings.push(`${field}[${index}] missing numeric note`);
        return;
      }
      sanitizedEvent.note = note;
    }

    if (config.requireNotesArray) {
      const notes = deriveChordNotes(sanitizedEvent.notes, sanitizedEvent.note);
      if (!notes.length) {
        warnings.push(`${field}[${index}] missing chord notes`);
        return;
      }
      sanitizedEvent.notes = notes;
    }

    if (config.requireType) {
      const type = typeof sanitizedEvent.type === 'string' && sanitizedEvent.type.trim().length
        ? sanitizedEvent.type.trim()
        : inferDrumType(field, index);
      sanitizedEvent.type = type;
    }

    sanitized.push(sanitizedEvent);
  });

  if (sanitized.length > 1000) {
    warnings.push(`${field} array is very large (${sanitized.length} items); truncating to 1000`);
  }

  const minItems = config.minItems ?? 1;
  if (sanitized.length < minItems) {
    errors.push(`${field} needs at least ${minItems} valid events (got ${sanitized.length})`);
  }

  return {
    events: sanitized.slice(0, 1000),
    errors,
    warnings,
  };
}

function coerceSequenceEvent(
  rawValue: any,
  field: SequenceValidationConfig['field'],
  index: number,
  maxStep: number,
): Record<string, unknown> | null {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue)) {
    const [maybeStep, maybeValue, maybeDuration] = rawValue;
    return {
      step: Number.isFinite(maybeStep) ? Number(maybeStep) : defaultStepForIndex(index, maxStep),
      ...(field === 'drums' ? { type: maybeValue } : {}),
      ...(field === 'chords' ? { notes: Array.isArray(maybeValue) ? maybeValue : [maybeValue] } : { note: maybeValue }),
      duration: Number.isFinite(maybeDuration) && maybeDuration > 0
        ? maybeDuration
        : defaultDurationForField(field),
    };
  }

  if (typeof rawValue === 'string') {
    if (field === 'drums') {
      return { type: rawValue, step: defaultStepForIndex(index, maxStep), duration: 1 };
    }
    const noteValue = field === 'chords' ? parseChordNotes(rawValue) : rawValue;
    return {
      step: defaultStepForIndex(index, maxStep),
      ...(field === 'chords' ? { notes: noteValue } : { note: noteValue }),
      duration: defaultDurationForField(field),
    };
  }

  if (typeof rawValue === 'number' && field !== 'drums') {
    return {
      step: defaultStepForIndex(index, maxStep),
      note: rawValue,
      duration: defaultDurationForField(field),
    };
  }

  return null;
}

function deriveNoteValue(raw: any): number | null {
  if (Number.isFinite(raw)) return Math.floor(Number(raw));
  if (typeof raw === 'string') {
    const midi = noteNameToMidi(raw);
    return midi;
  }
  return null;
}

function deriveChordNotes(rawNotes: any, fallbackNote: any): number[] {
  const source = Array.isArray(rawNotes)
    ? rawNotes
    : typeof rawNotes === 'string'
      ? parseChordNotes(rawNotes)
      : fallbackNote !== undefined
        ? [fallbackNote]
        : [];

  return source
    .map((value) => {
      if (Number.isFinite(value)) return Math.floor(Number(value));
      if (typeof value === 'string') return noteNameToMidi(value);
      return null;
    })
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
}

function parseChordNotes(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function noteNameToMidi(note: string): number | null {
  const match = note.trim().match(/^([A-Ga-g])([#b]?)(\d+)?$/);
  if (!match) return null;
  const [, letter, accidental, octaveStr] = match;
  const baseMap: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  let value = baseMap[letter.toLowerCase()];
  if (accidental === '#') value += 1;
  if (accidental === 'b') value -= 1;
  const octave = Number(octaveStr ?? '4');
  return 12 * (octave + 1) + value;
}

function inferDrumType(field: string, index: number): string {
  if (field !== 'drums') return 'perc';
  if (index % 16 === 0) return 'kick';
  if (index % 8 === 4) return 'snare';
  return 'hihat';
}

function defaultDurationForField(field: string): number {
  switch (field) {
    case 'bass':
      return 4;
    case 'chords':
      return 4;
    case 'melody':
      return 1;
    default:
      return 1;
  }
}

function defaultStepForIndex(index: number, maxStep: number): number {
  const step = index % maxStep;
  return step;
}
