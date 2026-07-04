/**
 * Pick which motif vocabulary the lead draws from. Pure + testable.
 *
 * The key insight (user feedback, 2026-06-23): the arp/bell banks sound like
 * finger exercises on a SINGING instrument. Violin/cello/wind/brass leads route
 * to the `lyrical` bank instead — in BOTH auto (demo, no mic) and live modes,
 * because the auto performance has to wow on its own. Keyboard (piano) joined
 * this set 2026-07-04: the arps/fills banks are only ~3 short chord-tone
 * motifs each, so piano read as "stuck on a loop" — a real melodic bank fits
 * a piano lead far better even though piano can't sustain/swell like a bow
 * or breath.
 *
 * NOTE: this function was built and unit-tested on 2026-06-23 but never
 * actually called from MelodyGenerator.ts until 2026-07-04 — every family
 * was silently getting the arps/fills/ostinatos treatment regardless of this
 * function's logic. Wired in as part of the same fix that added keyboard.
 */
export interface MotifBankSelectionInput {
  /** Performer family: 'bowed' | 'wind' | 'brass' | 'keyboard' | 'plucked' | 'synth' | ... */
  family: string | undefined
  /** Is a vocalist currently on the mic? */
  voiceActive: boolean
  /** Chorus/hook contrast bank set by the arrangement; overrides everything. */
  preferredBankKey: string | null
  /** Deterministic seed (0-9) for the auto-mode arps/fills split. */
  chordSeed: number
}

/** Singing families that should play lyrical lines, not arpeggios. */
const LYRICAL_FAMILIES = new Set(['bowed', 'wind', 'brass', 'keyboard'])

export function selectMotifBankKey(input: MotifBankSelectionInput): string {
  const { family, voiceActive, preferredBankKey, chordSeed } = input
  if (preferredBankKey) return preferredBankKey
  if (family && LYRICAL_FAMILIES.has(family)) return 'lyrical'
  if (!voiceActive) return chordSeed > 5 ? 'arps' : 'fills'
  return 'ostinatos'
}
