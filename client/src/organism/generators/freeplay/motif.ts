// The repetition discipline: each (generator, section) commits to ONE rhythm
// motif and develops it. "Repetition IS the rhyme" — never re-roll per bar.

export interface RhythmMotif {
  /** Sorted unique 16th slots (0..15) that fire within one bar. */
  slots: number[]
}

const motifStore = new Map<string, RhythmMotif>()

/** Clear all committed motifs (called on orchestrator cold start). */
export function clearMotifs(): void {
  motifStore.clear()
}

/** Downbeat-first candidate order so motifs feel grounded, not random. */
const WEIGHTED_SLOTS = [0, 8, 4, 12, 6, 14, 2, 10, 3, 7, 11, 15, 1, 5, 9, 13]

/** Get (or commit) the section's motif. Anchors (e.g. kick slots) always kept. */
export function getSectionMotif(
  key: string,
  rng: () => number,
  density: number,
  anchorSlots: number[] = [],
): RhythmMotif {
  const existing = motifStore.get(key)
  if (existing) return existing

  const slots = new Set<number>([0])
  for (const a of anchorSlots) slots.add(((Math.floor(a) % 16) + 16) % 16)
  const target = Math.max(2, Math.min(8, 2 + Math.round(density * 4) + anchorSlots.length))
  for (const c of WEIGHTED_SLOTS) {
    if (slots.size >= target) break
    if (rng() < 0.6) slots.add(c)
  }
  if (slots.size < 2) slots.add(8)

  const motif: RhythmMotif = { slots: [...slots].sort((a, b) => a - b) }
  motifStore.set(key, motif)
  return motif
}

/** One development operation: add ONE, drop ONE, or shift ONE onset by a 16th.
 *  Never touches the downbeat. Bounded — this is variation, not a new idea. */
export function varyMotif(motif: RhythmMotif, rng: () => number): RhythmMotif {
  const slots = new Set(motif.slots)
  const movable = motif.slots.filter(s => s !== 0)
  const op = Math.floor(rng() * 3)

  if (op === 0 && slots.size < 8) {
    slots.add(Math.floor(rng() * 16))
  } else if (op === 1 && slots.size > 2 && movable.length > 0) {
    slots.delete(movable[Math.floor(rng() * movable.length)])
  } else if (movable.length > 0) {
    const s = movable[Math.floor(rng() * movable.length)]
    slots.delete(s)
    slots.add(Math.min(15, Math.max(1, s + (rng() < 0.5 ? -1 : 1))))
  }

  const out = [...slots].sort((a, b) => a - b)
  return { slots: out.length >= 2 ? out : motif.slots }
}
