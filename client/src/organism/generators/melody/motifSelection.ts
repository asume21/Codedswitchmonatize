/**
 * Pick which motif vocabulary the lead draws from. Pure + testable.
 *
 * The key insight (user feedback, 2026-06-23): the arp/bell banks sound like
 * finger exercises on a SINGING instrument. Violin/cello/wind/brass leads route
 * to the `lyrical` bank instead — in BOTH auto (demo, no mic) and live modes,
 * because the auto performance has to wow on its own.
 *
 * 2026-07-05: soloing piano measured ~12 onsets/sec of arp/fill content and
 * didn't read as a melody at all — piano gets the same lyrical treatment now.
 */
export interface MotifBankSelectionInput {
  /** Performer family: 'bowed' | 'wind' | 'brass' | 'keys' | 'pluck' | ... */
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
