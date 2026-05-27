// Section 04 — Bass Pattern Library
//
// Provides bass note sequences that sync with the 4-bar drum patterns.
// Each behavior generates a 4-bar (4m) loop with swing, syncopation,
// and mode-appropriate intervals.
//
// New behaviors: Slide808, WestCoast, DirtySouth, Phonk, Jersey, Reggaeton

import { BassBehavior } from '../types'
import type { ScheduledNote } from '../types'
import type { OrganismMode } from '../../physics/types'
import type { OState } from '../../state/types'
import type { HipHopSubGenre } from '../../state/MusicalState'

// Pentatonic minor intervals from root
export const PENTATONIC_MINOR: number[] = [0, 3, 5, 7, 10]

// Natural minor intervals for walking lines
const NATURAL_MINOR: number[] = [0, 2, 3, 5, 7, 8, 10]

// Blues scale for funky bass
const BLUES_SCALE: number[] = [0, 3, 5, 6, 7, 10]

// ── Genre-aware swing amounts ────────────────────────────────────────
// Must match DrumPatternLibrary swing values so bass grooves lock with drums.
const MODE_SWING: Record<string, number> = {
  heat:   0.20,
  gravel: 0.22,
  smoke:  0.55,
  ice:    0.48,
  glow:   0.38,
}

const SUBGENRE_SWING: Record<string, number> = {
  'boom-bap':    0.60,
  'trap':        0.20,
  'drill':       0.22,
  'lo-fi':       0.48,
  'west-coast':  0.52,
  'dirty-south': 0.35,
  'phonk':       0.28,
  'jersey-club': 0.15,
  'bounce':      0.42,
  'reggaeton':   0.10,
  'afrobeat':    0.35,
  'chill':       0.38,
}

let currentSwing = 0.35

/** Set the swing amount based on the current physics mode. */
export function setBassSwing(mode: string): void {
  currentSwing = MODE_SWING[mode] ?? SUBGENRE_SWING[mode] ?? 0.35
}

/** Set swing from sub-genre directly. */
export function setBassSwingFromSubGenre(subGenre: HipHopSubGenre): void {
  currentSwing = SUBGENRE_SWING[subGenre] ?? 0.35
}

// ── Helpers ─────────────────────────────────────────────────────────

function swingTime(bar: number, beat: number, sub: number): string {
  const swungSub = (sub === 1 || sub === 3) ? sub + currentSwing : sub
  return `${bar}:${beat}:${swungSub.toFixed(2)}`
}

/** 
 * Deterministic velocity humanization.
 * Uses the note's position as a seed so the performance is unique but stable.
 */
function hv(base: number, bar: number, beat: number, sub: number, spread = 0.06): number {
  const seed = (bar * 16) + (beat * 4) + sub
  // Simple deterministic pseudo-random hash
  const hash = Math.sin(seed * 12.9898) * 43758.5453
  const pseudoRandom = hash - Math.floor(hash)
  return Math.min(1, Math.max(0.1, base + (pseudoRandom - 0.5) * spread * 2))
}

function pickFrom<T>(arr: T[], bar: number = 0): T {
  const seed = bar * 7.13
  const hash = Math.sin(seed) * 10000
  const idx = Math.floor((hash - Math.floor(hash)) * arr.length)
  return arr[idx]
}

function midiToNote(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  const name = names[midi % 12]
  return `${name}${octave}`
}

// ══════════════════════════════════════════════════════════════════════
//  ORIGINAL BASS PATTERNS (preserved)
// ══════════════════════════════════════════════════════════════════════

/** Long sustained root with subtle movement — minimal states */
export function buildBreatheNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const root = rootMidi
  const fifth = rootMidi + 7
  const octDown = rootMidi - 12
  
  // High density makes breathe more rhythmic (shorter notes)
  const dur = density > 0.75 ? '2n' : '1m'

  for (let bar = 0; bar < 4; bar++) {
    const anchor = bar % 2 === 1 ? octDown : root
    notes.push({ pitch: midiToNote(anchor), duration: dur, velocity: hv(0.64, bar, 0, 0), time: swingTime(bar, 0, 0) })
    notes.push({ pitch: midiToNote(bar === 2 ? fifth : root), duration: '4n', velocity: hv(0.48, bar, 2, 0), time: swingTime(bar, 2, 0) })
  }

  return notes
}

/** Kick-locked 8th note pattern — tight rhythmic lock */
export function buildLockNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const pent = PENTATONIC_MINOR
  const degrees = [0, 0, 4, 0, 0, 2, 0, 1]
  
  // High density → staccato
  const mainDur = density > 0.8 ? '16n' : '8n'

  for (let bar = 0; bar < 4; bar++) {
    notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: mainDur, velocity: hv(0.85, bar, 0, 0), time: swingTime(bar, 0, 0) })
    notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: '16n', velocity: hv(0.55, bar, 0, 2), time: swingTime(bar, 0, 2) })
    const deg2 = pickFrom(degrees, bar * 2 + 1)
    notes.push({ pitch: midiToNote(rootMidi + pent[deg2]), duration: mainDur, velocity: hv(0.68, bar, 1, 2), time: swingTime(bar, 1, 2) })
    notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: mainDur, velocity: hv(0.80, bar, 2, 0), time: swingTime(bar, 2, 0) })
    const deg4 = pickFrom(degrees, bar * 2)
    notes.push({ pitch: midiToNote(rootMidi + pent[deg4]), duration: mainDur, velocity: hv(0.65, bar, 3, 0), time: swingTime(bar, 3, 0) })
    if (bar < 3) {
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.50, bar, 3, 2), time: swingTime(bar, 3, 2) })
    }
  }
  return notes
}

/** Walking bass line through scale — melodic movement */
export function buildWalkNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const scale = NATURAL_MINOR
  let degree = 0
  
  const mainDur = density > 0.7 ? '8n' : '4n'

  for (let bar = 0; bar < 4; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      const interval = scale[Math.abs(degree) % scale.length]
      const octaveShift = degree < 0 ? -12 : degree >= scale.length ? 12 : 0
      const midi = rootMidi + interval + octaveShift
      const vel = beat === 0 ? 0.78 : beat === 2 ? 0.70 : 0.60

      notes.push({
        pitch:    midiToNote(midi),
        duration: mainDur,
        velocity: hv(vel, bar, beat, 0),
        time:     swingTime(bar, beat, 0),
      })

      // Deterministic step for walking line (still unique per bar)
      const seed = bar * 4 + beat
      const hash = Math.sin(seed * 1.5)
      const step = hash < -0.3 ? -1 : hash < 0.4 ? 1 : 2
      degree = Math.max(-2, Math.min(scale.length + 1, degree + step))
    }
    if (bar === 2) degree = (Math.sin(bar) > 0) ? 2 : -1
    if (bar === 3) degree = 0
  }
  return notes
}

/** Bouncy syncopated 8th/16th pattern — energetic rhythmic drive */
export function buildBounceNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const pent = PENTATONIC_MINOR
  const fifth = rootMidi + 7
  const octDown = rootMidi - 12
  
  const mainDur = density > 0.8 ? '16n' : '8n'

  for (let bar = 0; bar < 4; bar++) {
    notes.push({ pitch: midiToNote(rootMidi), duration: '16n', velocity: hv(0.90, bar, 0, 0), time: swingTime(bar, 0, 0) })
    notes.push({ pitch: midiToNote(rootMidi), duration: '16n', velocity: hv(0.40, bar, 0, 1), time: swingTime(bar, 0, 1) })
    notes.push({ pitch: midiToNote(fifth),    duration: '16n', velocity: hv(0.65, bar, 0, 2), time: swingTime(bar, 0, 2) })
    notes.push({ pitch: midiToNote(octDown),  duration: mainDur,  velocity: hv(0.60, bar, 1, 2), time: swingTime(bar, 1, 2) })
    notes.push({ pitch: midiToNote(rootMidi), duration: '16n', velocity: hv(0.82, bar, 2, 0), time: swingTime(bar, 2, 0) })
    
    const randomDeg = pent[pickFrom([1, 2, 3], bar)]
    notes.push({ pitch: midiToNote(rootMidi + randomDeg), duration: '16n', velocity: hv(0.55, bar, 2, 3), time: swingTime(bar, 2, 3) })
    
    if (bar < 3) {
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.52, bar, 3, 2), time: swingTime(bar, 3, 2) })
    } else {
      notes.push({ pitch: midiToNote(rootMidi + pent[2]), duration: '16n', velocity: hv(0.55, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.58, bar, 3, 1), time: swingTime(bar, 3, 1) })
      notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: '16n', velocity: hv(0.65, bar, 3, 2), time: swingTime(bar, 3, 2) })
      notes.push({ pitch: midiToNote(octDown),            duration: '16n', velocity: hv(0.70, bar, 3, 3), time: swingTime(bar, 3, 3) })
    }
  }
  return notes
}

/** Trap 808 style — long sustained notes, heavy sub, occasional slides */
export function buildTrapNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const fifth   = rootMidi + 7
  const minor7  = rootMidi + 10
  const octDown = rootMidi - 12
  
  const mainDur = density > 0.85 ? '4n' : '2n'

  for (let bar = 0; bar < 4; bar++) {
    const isLastBar = bar === 3
    notes.push({ pitch: midiToNote(octDown), duration: isLastBar ? '2n.' : mainDur, velocity: hv(0.95, bar, 0, 0), time: swingTime(bar, 0, 0) })
    
    // Deterministic ghost note
    if (Math.sin(bar * 3.14) > 0) {
      notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.35, bar, 1, 2), time: swingTime(bar, 1, 2) })
    }
    const p3 = bar % 2 === 0 ? fifth : rootMidi
    notes.push({ pitch: midiToNote(p3 - 12), duration: '4n', velocity: hv(0.80, bar, 2, 0), time: swingTime(bar, 2, 0) })
    notes.push({ pitch: midiToNote(minor7 - 12), duration: '16n', velocity: hv(0.50, bar, 2, 2), time: swingTime(bar, 2, 2) })
    if (!isLastBar) {
      notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.60, bar, 3, 2), time: swingTime(bar, 3, 2) })
    } else {
      notes.push({ pitch: midiToNote(octDown),    duration: '16n', velocity: hv(0.55, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(rootMidi - 7), duration: '16n', velocity: hv(0.60, bar, 3, 1), time: swingTime(bar, 3, 1) })
      notes.push({ pitch: midiToNote(rootMidi),   duration: '16n', velocity: hv(0.70, bar, 3, 2), time: swingTime(bar, 3, 2) })
    }
  }
  return notes
}

/** Funk style — 16th note syncopation, call-and-response, lots of ghost notes */
export function buildFunkNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const pent = PENTATONIC_MINOR
  const octDown = rootMidi - 12
  
  const mainDur = '16n' // Always funky short

  for (let bar = 0; bar < 4; bar++) {
    notes.push({ pitch: midiToNote(rootMidi), duration: mainDur, velocity: hv(0.88, bar, 0, 0), time: swingTime(bar, 0, 0) })
    notes.push({ pitch: midiToNote(octDown),  duration: '16n', velocity: hv(0.28, bar, 0, 1), time: swingTime(bar, 0, 1) })
    notes.push({ pitch: midiToNote(rootMidi + pent[2]), duration: '16n', velocity: hv(0.62, bar, 0, 2), time: swingTime(bar, 0, 2) })
    notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.40, bar, 0, 3), time: swingTime(bar, 0, 3) })
    notes.push({ pitch: midiToNote(rootMidi + pent[3]), duration: '8n', velocity: hv(0.72, bar, 1, 2), time: swingTime(bar, 1, 2) })
    notes.push({ pitch: midiToNote(octDown),  duration: '16n', velocity: hv(0.84, bar, 2, 0), time: swingTime(bar, 2, 0) })
    notes.push({ pitch: midiToNote(octDown),  duration: '16n', velocity: hv(0.30, bar, 2, 1), time: swingTime(bar, 2, 1) })
    
    const syncopatedDeg = pent[pickFrom([1, 2, 4], bar + 10)]
    notes.push({ pitch: midiToNote(rootMidi + syncopatedDeg), duration: '16n', velocity: hv(0.60, bar, 2, 2), time: swingTime(bar, 2, 2) })
    
    notes.push({ pitch: midiToNote(rootMidi), duration: '8n', velocity: hv(0.65, bar, 3, 0), time: swingTime(bar, 3, 0) })
    if (bar < 3) {
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.55, bar, 3, 2), time: swingTime(bar, 3, 2) })
    }
  }
  return notes
}

/** Dub/reggae style — heavy on 1, skip beat 2, hit on "and" of 2 and beat 3 */
export function buildDubNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const fifth  = rootMidi + 7
  const fourth = rootMidi + 5
  const octDown = rootMidi - 12
  
  const mainDur = density > 0.8 ? '8n' : '4n'

  for (let bar = 0; bar < 4; bar++) {
    if (bar % 2 === 0) {
      notes.push({ pitch: midiToNote(rootMidi), duration: mainDur, velocity: hv(0.90, bar, 0, 0), time: swingTime(bar, 0, 0) })
      notes.push({ pitch: midiToNote(fifth),    duration: '8n', velocity: hv(0.72, bar, 1, 2), time: swingTime(bar, 1, 2) })
      notes.push({ pitch: midiToNote(octDown),  duration: mainDur, velocity: hv(0.78, bar, 2, 0), time: swingTime(bar, 2, 0) })
      notes.push({ pitch: midiToNote(fifth),    duration: '8n', velocity: hv(0.58, bar, 2, 2), time: swingTime(bar, 2, 2) })
    } else {
      notes.push({ pitch: midiToNote(rootMidi), duration: '8n', velocity: hv(0.85, bar, 0, 0), time: swingTime(bar, 0, 0) })
      notes.push({ pitch: midiToNote(fourth),   duration: '8n', velocity: hv(0.60, bar, 0, 2), time: swingTime(bar, 0, 2) })
      notes.push({ pitch: midiToNote(octDown),  duration: mainDur, velocity: hv(0.75, bar, 1, 2), time: swingTime(bar, 1, 2) })
      notes.push({ pitch: midiToNote(fifth),    duration: mainDur, velocity: hv(0.70, bar, 2, 0), time: swingTime(bar, 2, 0) })
      notes.push({ pitch: midiToNote(rootMidi), duration: '8n', velocity: hv(0.55, bar, 2, 2), time: swingTime(bar, 2, 2) })
    }
  }
  return notes
}


// ══════════════════════════════════════════════════════════════════════
//  NEW SUB-GENRE BASS PATTERNS
// ══════════════════════════════════════════════════════════════════════

/**
 * 808 Slide — trap/drill bass with portamento between notes.
 * Long sustained 808s that GLIDE between pitches. The BassGenerator
 * must set synth.portamento when this behavior is active.
 *
 * Note intervals are spaced to create that iconic sliding sub-bass sound.
 * The generator handles the actual glide — we just provide notes that
 * are close enough in pitch to create smooth slides.
 */
export function buildSlide808Notes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const octDown = rootMidi - 12
  const fifth = rootMidi + 7
  const minor3 = rootMidi + 3
  const minor7 = rootMidi + 10
  
  const mainDur = density > 0.8 ? '4n' : '2n'

  // Slide targets — notes that create satisfying glides from root
  const slideTargets = [fifth - 12, minor3 - 12, minor7 - 12, rootMidi - 5]

  for (let bar = 0; bar < 4; bar++) {
    const isLastBar = bar === 3

    // Beat 1: heavy root (long sustained — the 808 body)
    notes.push({ pitch: midiToNote(octDown), duration: mainDur, velocity: hv(0.98, bar, 0, 0), time: swingTime(bar, 0, 0) })

    // Beat 3: SLIDE to a different note — this is where portamento kicks in
    const slideTarget = pickFrom(slideTargets, bar)
    notes.push({ pitch: midiToNote(slideTarget), duration: '4n', velocity: hv(0.82, bar, 2, 0), time: swingTime(bar, 2, 0) })

    // "and" of 3: slide back toward root
    notes.push({ pitch: midiToNote(octDown), duration: '8n', velocity: hv(0.70, bar, 2, 2), time: swingTime(bar, 2, 2) })

    if (isLastBar) {
      // Fill: rapid pitch slides for dramatic effect
      notes.push({ pitch: midiToNote(minor3 - 12), duration: '16n', velocity: hv(0.65, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(fifth - 12),  duration: '16n', velocity: hv(0.70, bar, 3, 1), time: swingTime(bar, 3, 1) })
      notes.push({ pitch: midiToNote(minor7 - 12), duration: '16n', velocity: hv(0.75, bar, 3, 2), time: swingTime(bar, 3, 2) })
      notes.push({ pitch: midiToNote(octDown),      duration: '16n', velocity: hv(0.85, bar, 3, 3), time: swingTime(bar, 3, 3) })
    } else {
      // Pickup note sliding into next bar
      notes.push({ pitch: midiToNote(octDown + 2), duration: '16n', velocity: hv(0.55, bar, 3, 2), time: swingTime(bar, 3, 2) })
    }
  }
  return notes
}

/**
 * West Coast / G-funk bass — Parliament-inspired bounce.
 * Syncopated, funky, uses chromatic approach notes.
 * Higher register than trap, more melodic movement.
 */
export function buildWestCoastNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const pent = PENTATONIC_MINOR
  const octDown = rootMidi - 12
  
  const mainDur = density > 0.8 ? '16n' : '8n'

  for (let bar = 0; bar < 4; bar++) {
    const isLastBar = bar === 3

    // Beat 1: root with funky pop
    notes.push({ pitch: midiToNote(rootMidi), duration: mainDur, velocity: hv(0.88, bar, 0, 0), time: swingTime(bar, 0, 0) })
    // "and" of 1: chromatic approach — step down then back up
    notes.push({ pitch: midiToNote(rootMidi - 1), duration: '16n', velocity: hv(0.48, bar, 0, 2), time: swingTime(bar, 0, 2) })
    // "a" of 1: resolve back
    notes.push({ pitch: midiToNote(rootMidi), duration: '16n', velocity: hv(0.55, bar, 0, 3), time: swingTime(bar, 0, 3) })

    // Beat 2: rest (let snare breathe)
    // "and" of 2: syncopated bounce — the G-funk signature
    notes.push({ pitch: midiToNote(rootMidi + pent[2]), duration: '8n', velocity: hv(0.72, bar, 1, 2), time: swingTime(bar, 1, 2) })

    // Beat 3: octave down root for weight
    notes.push({ pitch: midiToNote(octDown), duration: '8n', velocity: hv(0.82, bar, 2, 0), time: swingTime(bar, 2, 0) })
    // "and" of 3: pentatonic climb
    const deg = pickFrom(pent, bar + 1)
    notes.push({ pitch: midiToNote(rootMidi + deg), duration: '16n', velocity: hv(0.58, bar, 2, 2), time: swingTime(bar, 2, 2) })

    // Beat 4: approach note to next bar's root
    if (!isLastBar) {
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '8n', velocity: hv(0.62, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(rootMidi - 2), duration: '16n', velocity: hv(0.45, bar, 3, 2), time: swingTime(bar, 3, 2) })
    } else {
      // Fill: chromatic walk back to root
      notes.push({ pitch: midiToNote(rootMidi + 3), duration: '16n', velocity: hv(0.55, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(rootMidi + 2), duration: '16n', velocity: hv(0.58, bar, 3, 1), time: swingTime(bar, 3, 1) })
      notes.push({ pitch: midiToNote(rootMidi + 1), duration: '16n', velocity: hv(0.62, bar, 3, 2), time: swingTime(bar, 3, 2) })
      notes.push({ pitch: midiToNote(rootMidi),     duration: '16n', velocity: hv(0.70, bar, 3, 3), time: swingTime(bar, 3, 3) })
    }
  }
  return notes
}

/**
 * Dirty South / Crunk bass — massive root slams.
 * Sparse but HEAVY. Long sustained notes with aggressive velocity.
 * Designed to shake subwoofers, not be melodic.
 */
export function buildDirtySouthNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const octDown = rootMidi - 12
  const fifth = rootMidi + 7
  
  const mainDur = density > 0.8 ? '2n' : '2n.'

  for (let bar = 0; bar < 4; bar++) {
    const isLastBar = bar === 3

    // Beat 1: SLAM on sub root — long sustain
    notes.push({ pitch: midiToNote(octDown), duration: mainDur, velocity: hv(1.0, bar, 0, 0), time: swingTime(bar, 0, 0) })

    // Beat 3: reinforce the sub so sampled basses do not feel like one-shot dropouts
    notes.push({ pitch: midiToNote(bar % 2 === 0 ? fifth - 12 : octDown), duration: '4n', velocity: hv(0.72, bar, 2, 0), time: swingTime(bar, 2, 0) })

    // Beat 3 "and": short pickup hit
    if (bar % 2 === 0) {
      notes.push({ pitch: midiToNote(octDown), duration: '8n', velocity: hv(0.65, bar, 2, 2), time: swingTime(bar, 2, 2) })
    } else {
      // Alternate bar: 5th for variation
      notes.push({ pitch: midiToNote(fifth - 12), duration: '8n', velocity: hv(0.60, bar, 2, 2), time: swingTime(bar, 2, 2) })
    }

    if (isLastBar) {
      // Fill: call-and-response — short stabs
      notes.push({ pitch: midiToNote(octDown),      duration: '16n', velocity: hv(0.72, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(fifth - 12),   duration: '16n', velocity: hv(0.68, bar, 3, 2), time: swingTime(bar, 3, 2) })
    }
  }
  return notes
}

/**
 * Phonk / Memphis bass — stuttered 808 with heavy distortion feel.
 * Combines long 808 sustains with rapid stuttered hits.
 * Dark, menacing, lo-fi aesthetic.
 */
export function buildPhonkNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const octDown = rootMidi - 12
  const minor3 = rootMidi + 3
  const minor7 = rootMidi + 10
  
  const mainDur = density > 0.8 ? '4n' : '4n.'

  for (let bar = 0; bar < 4; bar++) {
    const isLastBar = bar === 3

    // Beat 1: heavy 808 hit
    notes.push({ pitch: midiToNote(octDown), duration: mainDur, velocity: hv(0.95, bar, 0, 0), time: swingTime(bar, 0, 0) })

    // "and" of 1: stutter hit (the phonk signature)
    notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.45, bar, 0, 2), time: swingTime(bar, 0, 2) })

    // Beat 2 "and": ghost sub
    if (bar % 2 === 0) {
      notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.32, bar, 1, 2), time: swingTime(bar, 1, 2) })
    }

    // Beat 3: variation — minor 3rd or minor 7th
    const p3 = bar % 2 === 0 ? minor3 - 12 : minor7 - 12
    notes.push({ pitch: midiToNote(p3), duration: '4n', velocity: hv(0.80, bar, 2, 0), time: swingTime(bar, 2, 0) })

    // Beat 3 stutter
    notes.push({ pitch: midiToNote(p3), duration: '16n', velocity: hv(0.40, bar, 2, 2), time: swingTime(bar, 2, 2) })

    if (isLastBar) {
      // Dark fill: descending minor scale stabs
      notes.push({ pitch: midiToNote(minor7 - 12), duration: '16n', velocity: hv(0.60, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(rootMidi - 5), duration: '16n', velocity: hv(0.65, bar, 3, 1), time: swingTime(bar, 3, 1) })
      notes.push({ pitch: midiToNote(minor3 - 12), duration: '16n', velocity: hv(0.70, bar, 3, 2), time: swingTime(bar, 3, 2) })
      notes.push({ pitch: midiToNote(octDown),      duration: '16n', velocity: hv(0.80, bar, 3, 3), time: swingTime(bar, 3, 3) })
    } else {
      // Pickup into next bar
      notes.push({ pitch: midiToNote(octDown + 2), duration: '16n', velocity: hv(0.50, bar, 3, 2), time: swingTime(bar, 3, 2) })
    }
  }
  return notes
}

/**
 * Jersey Club bass — fast staccato 808 hits at 130+ BPM.
 * Very short, punchy notes that match the galloping kick pattern.
 * More rhythmic than melodic.
 */
export function buildJerseyNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const octDown = rootMidi - 12
  const fifth = rootMidi + 7
  
  // Jersey is already very dense/staccato, so we just pass through
  const mainDur = '16n'

  for (let bar = 0; bar < 4; bar++) {
    const isLastBar = bar === 3

    // Every beat: short staccato 808 (matches kick-every-beat pattern)
    for (let beat = 0; beat < 4; beat++) {
      notes.push({ pitch: midiToNote(octDown), duration: mainDur, velocity: hv(beat === 0 ? 0.90 : 0.72, bar, beat, 0), time: swingTime(bar, beat, 0) })
    }

    // Gallop pickup on "a" of 4 (matches jersey kick gallop)
    notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.58, bar, 3, 3), time: swingTime(bar, 3, 3) })

    // Extra syncopation on even bars
    if (bar % 2 === 0) {
      notes.push({ pitch: midiToNote(fifth - 12), duration: '16n', velocity: hv(0.55, bar, 1, 2), time: swingTime(bar, 1, 2) })
    }

    if (isLastBar) {
      // Double-time fill
      for (let beat = 2; beat < 4; beat++) {
        notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.50, bar, beat, 1), time: swingTime(bar, beat, 1) })
        notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.55, bar, beat, 3), time: swingTime(bar, beat, 3) })
      }
    }
  }
  return notes
}

/**
 * Reggaeton / Dembow bass — locks to the dembow kick pattern.
 * Root on beats 1 and 3 (matching kick), with chromatic pickup notes
 * that give it that Latin bounce. Very straight timing.
 */
export function buildReggaetonNotes(rootMidi: number, density: number = 0.5): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const octDown = rootMidi - 12
  const fifth = rootMidi + 7
  const fourth = rootMidi + 5
  
  const mainDur = density > 0.8 ? '8n' : '4n'

  for (let bar = 0; bar < 4; bar++) {
    const isLastBar = bar === 3

    // Beat 1: root (locks with dembow kick)
    notes.push({ pitch: midiToNote(octDown), duration: mainDur, velocity: hv(0.92, bar, 0, 0), time: swingTime(bar, 0, 0) })

    // "and" of 1: chromatic approach note — Latin flavor
    notes.push({ pitch: midiToNote(octDown + 1), duration: '16n', velocity: hv(0.42, bar, 0, 2), time: swingTime(bar, 0, 2) })

    // Beat 2: lighter hit on "and" (matches dembow snare on "and" of 2)
    notes.push({ pitch: midiToNote(octDown), duration: '16n', velocity: hv(0.55, bar, 1, 2), time: swingTime(bar, 1, 2) })

    // Beat 3: root again (locks with dembow kick)
    notes.push({ pitch: midiToNote(octDown), duration: '4n', velocity: hv(0.88, bar, 2, 0), time: swingTime(bar, 2, 0) })

    // "and" of 3: movement note — 4th or 5th
    const movNote = bar % 2 === 0 ? fourth - 12 : fifth - 12
    notes.push({ pitch: midiToNote(movNote), duration: '8n', velocity: hv(0.60, bar, 2, 2), time: swingTime(bar, 2, 2) })

    // Beat 4: pickup
    if (!isLastBar) {
      notes.push({ pitch: midiToNote(octDown - 1), duration: '16n', velocity: hv(0.45, bar, 3, 2), time: swingTime(bar, 3, 2) })
    } else {
      // Fill: rapid ascent
      notes.push({ pitch: midiToNote(octDown),     duration: '16n', velocity: hv(0.55, bar, 3, 0), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(octDown + 3), duration: '16n', velocity: hv(0.60, bar, 3, 1), time: swingTime(bar, 3, 1) })
      notes.push({ pitch: midiToNote(octDown + 5), duration: '16n', velocity: hv(0.65, bar, 3, 2), time: swingTime(bar, 3, 2) })
      notes.push({ pitch: midiToNote(octDown + 7), duration: '16n', velocity: hv(0.70, bar, 3, 3), time: swingTime(bar, 3, 3) })
    }
  }
  return notes
}


// ══════════════════════════════════════════════════════════════════════
//  UNIFIED PATTERN BUILDER
// ══════════════════════════════════════════════════════════════════════

/** Build bass notes for any behavior — the single entry point */
export function buildBassNotes(behavior: BassBehavior, rootMidi: number, density: number = 0.5): ScheduledNote[] {
  switch (behavior) {
    case BassBehavior.Lock:       return buildLockNotes(rootMidi, density)
    case BassBehavior.Walk:       return buildWalkNotes(rootMidi, density)
    case BassBehavior.Bounce:     return buildBounceNotes(rootMidi, density)
    case BassBehavior.Breathe:    return buildBreatheNotes(rootMidi, density)
    case BassBehavior.Trap:       return buildTrapNotes(rootMidi, density)
    case BassBehavior.Funk:       return buildFunkNotes(rootMidi, density)
    case BassBehavior.Dub:        return buildDubNotes(rootMidi, density)
    case BassBehavior.Slide808:   return buildSlide808Notes(rootMidi, density)
    case BassBehavior.WestCoast:  return buildWestCoastNotes(rootMidi, density)
    case BassBehavior.DirtySouth: return buildDirtySouthNotes(rootMidi, density)
    case BassBehavior.Phonk:      return buildPhonkNotes(rootMidi, density)
    case BassBehavior.Jersey:     return buildJerseyNotes(rootMidi, density)
    case BassBehavior.Reggaeton:  return buildReggaetonNotes(rootMidi, density)
  }
}


// ══════════════════════════════════════════════════════════════════════
//  SUB-GENRE → BASS BEHAVIOR MAPPING
// ══════════════════════════════════════════════════════════════════════

/** Maps sub-genre + organism state to the appropriate bass behavior */
const SUBGENRE_BASS_MAP: Record<string, Record<string, BassBehavior>> = {
  'boom-bap':    { BREATHING: BassBehavior.Dub,        FLOW: BassBehavior.Walk },
  'trap':        { BREATHING: BassBehavior.Trap,       FLOW: BassBehavior.Slide808 },
  'drill':       { BREATHING: BassBehavior.Slide808,   FLOW: BassBehavior.Lock },
  'lo-fi':       { BREATHING: BassBehavior.Breathe,    FLOW: BassBehavior.Walk },
  'west-coast':  { BREATHING: BassBehavior.WestCoast,  FLOW: BassBehavior.Funk },
  'dirty-south': { BREATHING: BassBehavior.DirtySouth, FLOW: BassBehavior.DirtySouth },
  'phonk':       { BREATHING: BassBehavior.Phonk,      FLOW: BassBehavior.Slide808 },
  'jersey-club': { BREATHING: BassBehavior.Jersey,     FLOW: BassBehavior.Jersey },
  'bounce':      { BREATHING: BassBehavior.Bounce,     FLOW: BassBehavior.Funk },
  'reggaeton':   { BREATHING: BassBehavior.Reggaeton,  FLOW: BassBehavior.Reggaeton },
  'afrobeat':    { BREATHING: BassBehavior.Dub,        FLOW: BassBehavior.Walk },
  'chill':       { BREATHING: BassBehavior.Breathe,    FLOW: BassBehavior.Dub },
}

/** Get bass behavior from sub-genre and organism state */
export function getBassBehaviorFromSubGenre(subGenre: HipHopSubGenre, organismState: string): BassBehavior {
  const map = SUBGENRE_BASS_MAP[subGenre]
  if (!map) return BassBehavior.Breathe
  return map[organismState] ?? BassBehavior.Breathe
}

/** Whether a given behavior should enable portamento on the synth */
export function shouldEnableSlide(behavior: BassBehavior): boolean {
  return behavior === BassBehavior.Slide808
}

/** Get the portamento time for a behavior (seconds) */
export function getPortamentoTime(behavior: BassBehavior): number {
  switch (behavior) {
    case BassBehavior.Slide808:   return 0.12   // smooth 808 glide
    case BassBehavior.WestCoast:  return 0.04   // subtle G-funk slide
    case BassBehavior.Phonk:      return 0.08   // dark slide
    default:                      return 0      // no portamento
  }
}


// ── Legacy mode / state mapping (backward compatible) ────────────────

const MODE_BASS_MAP: Record<string, Record<string, BassBehavior>> = {
  heat:   { BREATHING: BassBehavior.Trap,    FLOW: BassBehavior.Funk },
  ice:    { BREATHING: BassBehavior.Breathe, FLOW: BassBehavior.Walk },
  smoke:  { BREATHING: BassBehavior.Dub,     FLOW: BassBehavior.Walk },
  gravel: { BREATHING: BassBehavior.Bounce,  FLOW: BassBehavior.Lock },
  glow:   { BREATHING: BassBehavior.Trap,    FLOW: BassBehavior.Dub  },
}

export function getBassBehavior(
  mode: OrganismMode | string,
  organismState: OState,
): BassBehavior {
  const modeMap = MODE_BASS_MAP[mode.toString()]
  if (!modeMap) return BassBehavior.Breathe
  return modeMap[organismState] ?? BassBehavior.Breathe
}

export const MODE_BASS_FILTER: Record<string, number> = {
  heat:   800,
  ice:    400,
  smoke:  600,
  gravel: 500,
  glow:   350,
}

export function getBassFilterCutoff(mode: OrganismMode | string, pocket: number): number {
  const base = MODE_BASS_FILTER[mode.toString()] ?? 400
  return base * Math.max(0.25, 1 - pocket * 0.75)
}

/** Sub-genre specific filter cutoff targets */
export const SUBGENRE_BASS_FILTER: Record<string, number> = {
  'boom-bap':    600,
  'trap':        800,
  'drill':       700,
  'lo-fi':       400,
  'west-coast':  650,
  'dirty-south': 900,
  'phonk':       750,
  'jersey-club': 850,
  'bounce':      700,
  'reggaeton':   600,
  'afrobeat':    550,
  'chill':       350,
}

export function getBassFilterCutoffFromSubGenre(subGenre: HipHopSubGenre, pocket: number): number {
  const base = SUBGENRE_BASS_FILTER[subGenre] ?? 400
  return base * Math.max(0.25, 1 - pocket * 0.75)
}
