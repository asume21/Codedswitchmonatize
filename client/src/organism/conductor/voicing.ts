import type { ParsedChord } from './Conductor'

export interface Voicing {
  bass: number          // root in the bass register (MIDI)
  inner: number[]       // comping notes, voice-led, low→high (MIDI)
  guideTones: number[]  // the 3rd & 7th — the chord's colour (MIDI)
}

/**
 * How the comp voices the chord. 'close' = packed block (boom-bap, trap).
 * 'spread' = an open drop-2 voicing (the 2nd-from-top voice dropped an octave) —
 * the lush, airy comping lo-fi / R&B / soul live on. The Conductor picks the
 * style per sub-genre; the notes are identical, only the register spreads.
 */
export type VoicingStyle = 'close' | 'spread'

export interface VoicingOptions {
  /** Base MIDI for the bass root (C2 = 36). */
  bassBase?: number
  /** Target the first (anchorless) voicing centres on (C4 = 60). */
  center?: number
  /** Register the inner voices live in. */
  low?: number
  high?: number
  /** Comp voicing style; defaults to 'close'. */
  style?: VoicingStyle
}

const pc = (m: number) => ((m % 12) + 12) % 12

/**
 * Open a close voicing into a drop-2 spread: drop the SECOND-from-top voice an
 * octave. Same pitch classes, wider register — the open comp sound. Needs ≥3
 * voices to have a meaningful inner voice to drop; smaller shapes pass through.
 * Returns a fresh sorted array.
 */
function applySpread(closeInner: number[], style: VoicingStyle): number[] {
  if (style === 'close' || closeInner.length < 3) return closeInner
  const v = [...closeInner].sort((a, b) => a - b)
  v[v.length - 2] -= 12 // drop-2: the 2nd-from-top voice down an octave
  return v.sort((a, b) => a - b)
}

/** The MIDI note of pitch-class `p` nearest to `target`, within [low, high]. */
function nearestWithPC(p: number, target: number, low: number, high: number): number {
  const want = pc(p)
  let best = want + 12 * Math.round((target - want) / 12) // fallback
  let bestDist = Infinity
  for (let m = low; m <= high; m++) {
    if (pc(m) !== want) continue
    const d = Math.abs(m - target)
    if (d < bestDist) { bestDist = d; best = m }
  }
  return best
}

/**
 * Conductor Part 3 V1 — voice a chord as ONE coordinated thing with voice-leading.
 *
 * Instead of every player restacking the chord symbol independently, the
 * Conductor decides: the bass note (low), the comping voices (moved MINIMALLY
 * from the previous voicing — common tones held, the rest stepping to the
 * nearest note), and the guide tones (3rd & 7th — the colour the melody should
 * complement). Pure; the generators read this instead of guessing.
 */
export function voiceChord(
  chord: ParsedChord,
  prev: Voicing | null,
  opts: VoicingOptions = {},
): Voicing {
  // Comping register: chords live around octave 3 (C3–G4), an octave below the
  // lead. Voicing them up at octave 4+ reads as bright "toy-keyboard" against an
  // 808 (see ChordGenerator's register note). Bass sits below at octave 2.
  const bassBase = opts.bassBase ?? 36   // C2
  const center = opts.center ?? 55       // G3
  const low = opts.low ?? 48             // C3
  const high = opts.high ?? 67           // G4

  const rootPC = pc(chord.rootMidi)
  const bass = bassBase + rootPC          // 36..47

  // Unique chord pitch classes from the intervals.
  const chordPCs = [...new Set(chord.intervals.map((i) => pc(chord.rootMidi + i)))]

  // Voice each chord tone with minimal movement from the previous voicing:
  // a shared pitch class lands on the SAME note (held); the rest step nearest.
  const inner = chordPCs
    .map((p) => {
      if (prev && prev.inner.length) {
        let chosen = nearestWithPC(p, center, low, high)
        let chosenDist = Infinity
        for (const prevNote of prev.inner) {
          const cand = nearestWithPC(p, prevNote, low, high)
          const d = Math.abs(cand - prevNote)
          if (d < chosenDist) { chosenDist = d; chosen = cand }
        }
        return chosen
      }
      return nearestWithPC(p, center, low, high)
    })
    .sort((a, b) => a - b)

  // Guide tones: the 3rd (interval 3 or 4) and 7th (interval 10 or 11).
  const guidePCs: number[] = []
  for (const i of chord.intervals) {
    const semi = pc(i)
    if (semi === 3 || semi === 4 || semi === 10 || semi === 11) {
      guidePCs.push(pc(chord.rootMidi + i))
    }
  }
  const guideTones = [...new Set(guidePCs)].map((p) => nearestWithPC(p, center, low, high))

  return { bass, inner: applySpread(inner, opts.style ?? 'close'), guideTones }
}
