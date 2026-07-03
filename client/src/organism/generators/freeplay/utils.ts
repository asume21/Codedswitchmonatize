// Pure helpers for the freeplay improvisers. NO tone imports (testability).

/**
 * Freeplay seed/salt — mixed into every freeplay seed at the CALL SITES (never
 * inside the pure improvisers — tests pass explicit rngs and stay exact).
 *
 * Contract (the user's rule): every organism start improvises a DIFFERENT beat
 * for the same preset, UNLESS a seed is pinned — then the beat reproduces
 * exactly. Without this, seeds like hashString('drums:verse:boom-bap') + a
 * counter starting at 0 made every start play the identical "improvised" beat.
 * Within one run the salt is constant, so section-motif stability is untouched.
 */
const randomSalt = () => Math.floor(Math.random() * 0x7fffffff)

let pinnedSeed: number | null = null
let sessionSalt: number = randomSalt()

export function getSessionSalt(): number {
  return sessionSalt
}

/** Pin the freeplay seed so the same preset replays the same beat; pass null
 *  to unpin and return to a-new-beat-every-start. Returns the active salt. */
export function setFreeplaySeed(seed: number | null): number {
  pinnedSeed = seed
  sessionSalt = seed === null ? randomSalt() : Math.floor(Math.abs(seed)) % 0x7fffffff
  return sessionSalt
}

/** Whether a seed is currently pinned (same beat on every start). */
export function isSeedPinned(): boolean {
  return pinnedSeed !== null
}

/** Called once per organism start: fresh salt, unless a seed is pinned. */
export function rerollSessionSalt(): number {
  if (pinnedSeed === null) sessionSalt = randomSalt()
  return sessionSalt
}

// Console access for reproducing a beat you like: the orchestrator logs the
// active seed on every start; `setFreeplaySeed(<that number>)` pins it.
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).setFreeplaySeed = setFreeplaySeed
}

/** Deterministic PRNG — same seed, same stream. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a string hash → 32-bit uint. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** MIDI number → scientific pitch (60 = C4), matching Tone.Frequency output. */
export function midiToNote(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

/**
 * 16th-slot (0..15) → "bar:beat:sub" with the band's swing convention:
 * off-beat 16ths (sub 1 and 3) are delayed by `swing` (same rule as
 * DrumPatternLibrary.swingTime — do NOT invent a different one).
 */
export function swungTime(bar: number, slot16: number, swing: number): string {
  const beat = Math.floor(slot16 / 4)
  const sub = slot16 % 4
  const swungSub = (sub === 1 || sub === 3) ? sub + Math.max(0, Math.min(1, swing)) : sub
  return `${bar}:${beat}:${swungSub.toFixed(2)}`
}

/** Humanised velocity (seeded twin of DrumPatternLibrary.hv). */
export function jitterVel(base: number, rng: () => number, spread = 0.08): number {
  return Math.min(1, Math.max(0.1, base + (rng() - 0.5) * spread * 2))
}

/** Tone duration notation → 16th-slot count ('8n' → 2, '1m' → 16, dotted ×1.5).
 *  Unknown shapes count as one slot — better to under-claim than block a bar. */
export function durationToSixteenths(duration: string): number {
  const value = String(duration).trim()
  const dotted = value.endsWith('.')
  const base = dotted ? value.slice(0, -1) : value
  let slots = 1
  if (base.endsWith('m')) {
    slots = (parseFloat(base) || 1) * 16
  } else if (base.endsWith('n')) {
    const denom = parseFloat(base.slice(0, -1)) || 16
    slots = 16 / denom
  }
  if (dotted) slots *= 1.5
  return Math.max(1, Math.round(slots))
}

/** Per-bar 16th slots (0..15) a melodic line OCCUPIES — onset plus held
 *  duration, folded across bars. The comp reads this to dodge the lead the
 *  same way it dodges the kick. */
export function extractBusySlots16ths(
  events: Array<{ time: string; dur: string }>,
): number[] {
  const busy = new Set<number>()
  for (const ev of events) {
    const [bar, beat, sub] = ev.time.split(':').map(parseFloat)
    if ([bar, beat, sub].some(Number.isNaN)) continue
    const start = bar * 16 + beat * 4 + Math.floor(sub)
    const len = durationToSixteenths(ev.dur)
    for (let i = 0; i < len; i++) busy.add(((start + i) % 16 + 16) % 16)
  }
  return [...busy].sort((a, b) => a - b)
}

/** Kick onset slots (absolute 16ths) from a DrumHit[] — used for bass glue.
 *  Times are "bar:beat:sub" strings; swing fractions floor to the slot. */
export function extractKickSlots(
  hits: Array<{ instrument: string; time: string }>,
): number[] {
  const slots = new Set<number>()
  for (const h of hits) {
    if (h.instrument !== 'kick') continue
    const [bar, beat, sub] = h.time.split(':').map(parseFloat)
    if ([bar, beat, sub].some(Number.isNaN)) continue
    slots.add(bar * 16 + beat * 4 + Math.floor(sub))
  }
  return [...slots].sort((a, b) => a - b)
}
