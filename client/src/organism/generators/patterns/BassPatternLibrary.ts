// Section 04 — Bass Pattern Library
//
// Provides bass note sequences that sync with the 4-bar drum patterns.
// Each behavior generates a 4-bar (4m) loop with swing, syncopation,
// and mode-appropriate intervals.

import { BassBehavior } from '../types'
import type { ScheduledNote } from '../types'
import type { OrganismMode } from '../../physics/types'
import type { OState } from '../../state/types'

// Pentatonic minor intervals from root
export const PENTATONIC_MINOR: number[] = [0, 3, 5, 7, 10]

// Natural minor intervals for walking lines
const NATURAL_MINOR: number[] = [0, 2, 3, 5, 7, 8, 10]

// ── Helpers ─────────────────────────────────────────────────────────

function swingTime(bar: number, beat: number, sub: number): string {
  const swungSub = (sub === 1 || sub === 3) ? sub + 0.35 : sub
  return `${bar}:${beat}:${swungSub.toFixed(2)}`
}

function hv(base: number, spread = 0.06): number {
  return Math.min(1, Math.max(0.1, base + (Math.random() - 0.5) * spread * 2))
}

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Bass note sequence builders (4 bars each) ───────────────────────

/** Long sustained root with subtle movement — minimal states */
export function buildBreatheNotes(rootMidi: number): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const root = rootMidi
  const fifth = rootMidi + 7
  const octDown = rootMidi - 12

  // Bar 1: whole note on root
  notes.push({ pitch: midiToNote(root),    duration: '1m', velocity: hv(0.60), time: swingTime(0, 0, 0) })
  // Bar 2: whole note on root (octave down for weight)
  notes.push({ pitch: midiToNote(octDown), duration: '1m', velocity: hv(0.55), time: swingTime(1, 0, 0) })
  // Bar 3: half on root, half on 5th
  notes.push({ pitch: midiToNote(root),    duration: '2n', velocity: hv(0.58), time: swingTime(2, 0, 0) })
  notes.push({ pitch: midiToNote(fifth),   duration: '2n', velocity: hv(0.50), time: swingTime(2, 2, 0) })
  // Bar 4: back to root, whole note
  notes.push({ pitch: midiToNote(root),    duration: '1m', velocity: hv(0.62), time: swingTime(3, 0, 0) })

  return notes
}

/** Kick-locked 8th note pattern — tight rhythmic lock */
export function buildLockNotes(rootMidi: number): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const pent = PENTATONIC_MINOR
  const degrees = [0, 0, 4, 0, 0, 2, 0, 1]  // root-heavy with 7th and 5th motion

  for (let bar = 0; bar < 4; bar++) {
    // Beat 1: always root (lock with kick)
    notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: '8n', velocity: hv(0.85), time: swingTime(bar, 0, 0) })
    // "and" of 1: syncopated (lock with kick double)
    notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: '16n', velocity: hv(0.55), time: swingTime(bar, 0, 2) })
    // Beat 2: rest (let snare hit)
    // "and" of 2: pick a degree
    const deg2 = degrees[(bar * 2 + 1) % degrees.length]
    notes.push({ pitch: midiToNote(rootMidi + pent[deg2]), duration: '8n', velocity: hv(0.68), time: swingTime(bar, 1, 2) })
    // Beat 3: root (lock with kick)
    notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: '8n', velocity: hv(0.80), time: swingTime(bar, 2, 0) })
    // Beat 4: movement note
    const deg4 = degrees[(bar * 2) % degrees.length]
    notes.push({ pitch: midiToNote(rootMidi + pent[deg4]), duration: '8n', velocity: hv(0.65), time: swingTime(bar, 3, 0) })
    // "and" of 4: approach note back to root
    if (bar < 3) {
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.50), time: swingTime(bar, 3, 2) })
    }
  }
  return notes
}

/** Walking bass line through scale — melodic movement */
export function buildWalkNotes(rootMidi: number): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const scale = NATURAL_MINOR
  let degree = 0

  for (let bar = 0; bar < 4; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      const interval = scale[Math.abs(degree) % scale.length]
      const octaveShift = degree < 0 ? -12 : degree >= scale.length ? 12 : 0
      const midi = rootMidi + interval + octaveShift
      const vel = beat === 0 ? 0.78 : beat === 2 ? 0.70 : 0.60

      notes.push({
        pitch:    midiToNote(midi),
        duration: '4n',
        velocity: hv(vel),
        time:     swingTime(bar, beat, 0),
      })

      // Walk: mostly stepwise, occasional skip
      const step = Math.random() < 0.75
        ? (Math.random() < 0.5 ? 1 : -1)
        : pickFrom([-2, 2, 3])
      degree = Math.max(-2, Math.min(scale.length + 1, degree + step))
    }
    // Resolve: bar 4 walks back toward root
    if (bar === 2) degree = Math.random() < 0.5 ? 2 : -1
    if (bar === 3) degree = 0
  }
  return notes
}

/** Bouncy syncopated 8th/16th pattern — energetic rhythmic drive */
export function buildBounceNotes(rootMidi: number): ScheduledNote[] {
  const notes: ScheduledNote[] = []
  const pent = PENTATONIC_MINOR
  const fifth = rootMidi + 7
  const octDown = rootMidi - 12

  for (let bar = 0; bar < 4; bar++) {
    // Beat 1: hard root
    notes.push({ pitch: midiToNote(rootMidi), duration: '16n', velocity: hv(0.90), time: swingTime(bar, 0, 0) })
    // "e" of 1: ghost
    notes.push({ pitch: midiToNote(rootMidi), duration: '16n', velocity: hv(0.40), time: swingTime(bar, 0, 1) })
    // "and" of 1: 5th
    notes.push({ pitch: midiToNote(fifth),    duration: '16n', velocity: hv(0.65), time: swingTime(bar, 0, 2) })
    // Beat 2: rest (snare space)
    // "and" of 2: octave down root
    notes.push({ pitch: midiToNote(octDown),  duration: '8n',  velocity: hv(0.60), time: swingTime(bar, 1, 2) })
    // Beat 3: root
    notes.push({ pitch: midiToNote(rootMidi), duration: '16n', velocity: hv(0.82), time: swingTime(bar, 2, 0) })
    // "a" of 3: movement
    notes.push({ pitch: midiToNote(rootMidi + pent[pickFrom([1, 2, 3])]), duration: '16n', velocity: hv(0.55), time: swingTime(bar, 2, 3) })
    // Beat 4: rest (snare space)
    // "and" of 4: approach note
    if (bar < 3) {
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.52), time: swingTime(bar, 3, 2) })
    } else {
      // Fill bar: 16th run back to root
      notes.push({ pitch: midiToNote(rootMidi + pent[2]), duration: '16n', velocity: hv(0.55), time: swingTime(bar, 3, 0) })
      notes.push({ pitch: midiToNote(rootMidi + pent[1]), duration: '16n', velocity: hv(0.58), time: swingTime(bar, 3, 1) })
      notes.push({ pitch: midiToNote(rootMidi + pent[0]), duration: '16n', velocity: hv(0.65), time: swingTime(bar, 3, 2) })
      notes.push({ pitch: midiToNote(octDown),            duration: '16n', velocity: hv(0.70), time: swingTime(bar, 3, 3) })
    }
  }
  return notes
}

function midiToNote(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  const name = names[midi % 12]
  return `${name}${octave}`
}

// ── Mode / state mapping ───────────────────────────────────────────

const MODE_BASS_MAP: Record<string, Record<string, BassBehavior>> = {
  heat:   { BREATHING: BassBehavior.Bounce,  FLOW: BassBehavior.Walk },
  ice:    { BREATHING: BassBehavior.Breathe, FLOW: BassBehavior.Lock },
  smoke:  { BREATHING: BassBehavior.Lock,    FLOW: BassBehavior.Walk },
  gravel: { BREATHING: BassBehavior.Bounce,  FLOW: BassBehavior.Bounce },
  glow:   { BREATHING: BassBehavior.Breathe, FLOW: BassBehavior.Lock },
}

export function getBassBehavior(
  mode: OrganismMode | string,
  organismState: OState,
): BassBehavior {
  const modeMap = MODE_BASS_MAP[mode.toString()]
  if (!modeMap) return BassBehavior.Breathe
  return modeMap[organismState] ?? BassBehavior.Breathe
}

// Filter cutoff targets per mode (Hz)
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
