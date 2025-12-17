/**
 * Advanced Drum Pattern Generator
 * Creates more dynamic, genre-appropriate drum patterns from code structure
 */

import type { ParsedCode } from '../../../shared/types/codeToMusic';

export interface DrumHit {
  instrument: 'kick' | 'snare' | 'hihat' | 'clap' | 'tom' | 'crash' | 'ride' | 'perc';
  time: number; // In seconds
  velocity: number; // 0-127
  duration: number;
}

export interface DrumPattern {
  hits: DrumHit[];
  pattern: {
    kick: boolean[];
    snare: boolean[];
    hihat: boolean[];
    clap: boolean[];
  };
  fills: DrumHit[];
}

// Genre-specific drum patterns (16 steps = 1 bar)
const GENRE_PATTERNS: Record<string, {
  kick: number[];
  snare: number[];
  hihat: number[];
  clap: number[];
}> = {
  pop: {
    kick: [0, 8],           // 1 and 3
    snare: [4, 12],         // 2 and 4
    hihat: [0, 2, 4, 6, 8, 10, 12, 14], // 8th notes
    clap: [4, 12],          // With snare
  },
  rock: {
    kick: [0, 6, 8, 14],    // Driving pattern
    snare: [4, 12],         // Backbeat
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    clap: [],
  },
  hiphop: {
    kick: [0, 3, 6, 10],    // Syncopated
    snare: [4, 12],
    hihat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 16th notes
    clap: [4, 12],
  },
  edm: {
    kick: [0, 4, 8, 12],    // Four on the floor
    snare: [],
    hihat: [2, 6, 10, 14],  // Offbeat
    clap: [4, 12],
  },
  rnb: {
    kick: [0, 7, 10],       // Laid back
    snare: [4, 12],
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    clap: [4],
  },
  country: {
    kick: [0, 8],
    snare: [4, 12],
    hihat: [0, 4, 8, 12],   // Quarter notes
    clap: [],
  },
};

// Complexity modifiers - add more hits based on code complexity
const COMPLEXITY_ADDITIONS: Record<number, {
  kick: number[];
  hihat: number[];
}> = {
  3: { kick: [], hihat: [] },
  5: { kick: [2], hihat: [1, 3, 5, 7, 9, 11, 13, 15] },
  7: { kick: [2, 10], hihat: [1, 3, 5, 7, 9, 11, 13, 15] },
  9: { kick: [2, 6, 10, 14], hihat: [1, 3, 5, 7, 9, 11, 13, 15] },
};

// Drum fills based on code events
const FILL_PATTERNS: Record<string, DrumHit[]> = {
  function: [
    { instrument: 'tom', time: 0, velocity: 100, duration: 0.1 },
    { instrument: 'tom', time: 0.125, velocity: 90, duration: 0.1 },
    { instrument: 'snare', time: 0.25, velocity: 110, duration: 0.1 },
  ],
  class: [
    { instrument: 'crash', time: 0, velocity: 100, duration: 0.5 },
    { instrument: 'kick', time: 0, velocity: 110, duration: 0.1 },
  ],
  loop: [
    { instrument: 'hihat', time: 0, velocity: 80, duration: 0.05 },
    { instrument: 'hihat', time: 0.0625, velocity: 70, duration: 0.05 },
    { instrument: 'hihat', time: 0.125, velocity: 80, duration: 0.05 },
    { instrument: 'hihat', time: 0.1875, velocity: 70, duration: 0.05 },
  ],
  return: [
    { instrument: 'crash', time: 0, velocity: 90, duration: 0.3 },
  ],
};

/**
 * Get base pattern for genre
 */
function getBasePattern(genre: string): typeof GENRE_PATTERNS.pop {
  return GENRE_PATTERNS[genre] || GENRE_PATTERNS.pop;
}

/**
 * Apply complexity modifiers to pattern
 */
function applyComplexity(
  pattern: typeof GENRE_PATTERNS.pop,
  complexity: number
): typeof GENRE_PATTERNS.pop {
  const level = complexity <= 3 ? 3 : complexity <= 5 ? 5 : complexity <= 7 ? 7 : 9;
  const additions = COMPLEXITY_ADDITIONS[level];
  
  return {
    kick: [...new Set([...pattern.kick, ...additions.kick])].sort((a, b) => a - b),
    snare: pattern.snare,
    hihat: [...new Set([...pattern.hihat, ...additions.hihat])].sort((a, b) => a - b),
    clap: pattern.clap,
  };
}

/**
 * Convert pattern steps to timed hits
 */
function patternToHits(
  pattern: typeof GENRE_PATTERNS.pop,
  bpm: number,
  barStart: number,
  barIndex: number
): DrumHit[] {
  const hits: DrumHit[] = [];
  const stepDuration = (60 / bpm) / 4; // 16th note duration
  
  // Velocity variation for groove
  const getVelocity = (step: number, base: number): number => {
    // Downbeats are louder
    if (step % 4 === 0) return Math.min(127, base + 15);
    // Offbeats slightly softer
    if (step % 2 === 1) return Math.max(60, base - 10);
    return base;
  };
  
  pattern.kick.forEach(step => {
    hits.push({
      instrument: 'kick',
      time: barStart + (step * stepDuration),
      velocity: getVelocity(step, 100),
      duration: 0.1,
    });
  });
  
  pattern.snare.forEach(step => {
    hits.push({
      instrument: 'snare',
      time: barStart + (step * stepDuration),
      velocity: getVelocity(step, 95),
      duration: 0.15,
    });
  });
  
  pattern.hihat.forEach(step => {
    // Alternate open/closed hihat for variety
    const isOpen = step % 8 === 6;
    hits.push({
      instrument: 'hihat',
      time: barStart + (step * stepDuration),
      velocity: getVelocity(step, isOpen ? 85 : 75),
      duration: isOpen ? 0.2 : 0.05,
    });
  });
  
  pattern.clap.forEach(step => {
    hits.push({
      instrument: 'clap',
      time: barStart + (step * stepDuration),
      velocity: getVelocity(step, 90),
      duration: 0.1,
    });
  });
  
  return hits;
}

/**
 * Generate fills at section transitions
 */
function generateFills(
  parsedCode: ParsedCode,
  bpm: number,
  totalBars: number
): DrumHit[] {
  const fills: DrumHit[] = [];
  const barDuration = (60 / bpm) * 4;
  
  // Add fills at significant code events
  parsedCode.elements.forEach((element, index) => {
    const fillPattern = FILL_PATTERNS[element.type];
    if (!fillPattern) return;
    
    // Calculate when this element's "section" starts
    const elementBar = Math.floor((index / parsedCode.elements.length) * totalBars);
    const fillTime = elementBar * barDuration;
    
    // Only add fill if it's at a bar boundary (every 4 bars for classes, every 2 for functions)
    const fillFrequency = element.type === 'class' ? 4 : element.type === 'function' ? 2 : 8;
    if (elementBar % fillFrequency !== 0) return;
    
    fillPattern.forEach(hit => {
      fills.push({
        ...hit,
        time: fillTime + hit.time,
      });
    });
  });
  
  return fills;
}

/**
 * Add ghost notes for groove (subtle hits between main beats)
 */
function addGhostNotes(
  hits: DrumHit[],
  complexity: number,
  bpm: number
): DrumHit[] {
  if (complexity < 5) return hits; // No ghost notes for simple code
  
  const ghostNotes: DrumHit[] = [];
  const stepDuration = (60 / bpm) / 4;
  
  // Find snare hits and add ghost notes before them
  hits.filter(h => h.instrument === 'snare').forEach(snare => {
    // Ghost note one 16th before snare
    ghostNotes.push({
      instrument: 'snare',
      time: snare.time - stepDuration,
      velocity: 40, // Very soft
      duration: 0.05,
    });
    
    if (complexity > 7) {
      // Additional ghost note two 16ths before
      ghostNotes.push({
        instrument: 'snare',
        time: snare.time - (stepDuration * 2),
        velocity: 30,
        duration: 0.05,
      });
    }
  });
  
  return [...hits, ...ghostNotes].sort((a, b) => a.time - b.time);
}

/**
 * Main drum pattern generation function
 */
export function generateAdvancedDrumPattern(
  parsedCode: ParsedCode,
  genre: string,
  bpm: number,
  totalDuration: number
): DrumPattern {
  // Get base pattern for genre
  let pattern = getBasePattern(genre);
  
  // Apply complexity modifiers
  pattern = applyComplexity(pattern, parsedCode.complexity);
  
  // Calculate number of bars
  const barDuration = (60 / bpm) * 4;
  const totalBars = Math.ceil(totalDuration / barDuration);
  
  // Generate hits for each bar
  let allHits: DrumHit[] = [];
  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * barDuration;
    const barHits = patternToHits(pattern, bpm, barStart, bar);
    allHits = allHits.concat(barHits);
  }
  
  // Add ghost notes for groove
  allHits = addGhostNotes(allHits, parsedCode.complexity, bpm);
  
  // Generate fills at transitions
  const fills = generateFills(parsedCode, bpm, totalBars);
  
  // Convert pattern to boolean arrays for compatibility
  const boolPattern = {
    kick: Array(16).fill(false),
    snare: Array(16).fill(false),
    hihat: Array(16).fill(false),
    clap: Array(16).fill(false),
  };
  
  pattern.kick.forEach(s => boolPattern.kick[s] = true);
  pattern.snare.forEach(s => boolPattern.snare[s] = true);
  pattern.hihat.forEach(s => boolPattern.hihat[s] = true);
  pattern.clap.forEach(s => boolPattern.clap[s] = true);
  
  return {
    hits: allHits,
    pattern: boolPattern,
    fills,
  };
}

/**
 * Convert drum pattern to MelodyNote format for unified playback
 */
export function drumPatternToNotes(drumPattern: DrumPattern): {
  note: string;
  start: number;
  duration: number;
  velocity: number;
  instrument: string;
  source: string;
}[] {
  const notes: {
    note: string;
    start: number;
    duration: number;
    velocity: number;
    instrument: string;
    source: string;
  }[] = [];
  
  // Map drum instruments to "notes" (for drum machine compatibility)
  const drumNotes: Record<string, string> = {
    kick: 'C2',
    snare: 'D2',
    hihat: 'F#2',
    clap: 'D#2',
    tom: 'A2',
    crash: 'C#3',
    ride: 'D#3',
    perc: 'G2',
  };
  
  [...drumPattern.hits, ...drumPattern.fills].forEach((hit, index) => {
    notes.push({
      note: drumNotes[hit.instrument] || 'C2',
      start: hit.time,
      duration: hit.duration,
      velocity: hit.velocity,
      instrument: `drums_${hit.instrument}`,
      source: `Drum: ${hit.instrument}`,
    });
  });
  
  return notes.sort((a, b) => a.start - b.start);
}
