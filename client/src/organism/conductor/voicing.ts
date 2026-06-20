import type { ParsedChord } from './Conductor'

export interface Voicing {
  bass: number          // root in the bass register (MIDI)
  inner: number[]       // comping notes, voice-led, low→high (MIDI)
  guideTones: number[]  // the 3rd & 7th — the chord's colour (MIDI)
}

export interface VoicingOptions {
  /** Base MIDI for the bass root (C2 = 36). */
  bassBase?: number
  /** Target the first (anchorless) voicing centres on (C4 = 60). */
  center?: number
  /** Register the inner voices live in. */
  low?: number
  high?: number
}

const pc = (m: number) => ((m % 12) + 12) % 12

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
  const bassBase = opts.bassBase ?? 36   // C2
  const center = opts.center ?? 60       // C4
  const low = opts.low ?? 48             // C3
  const high = opts.high ?? 76           // E5

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

  return { bass, inner, guideTones }
}
