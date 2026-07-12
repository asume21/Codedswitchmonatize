// client/src/organism/generators/freeplay/songCell.ts
//
// THE SONG CELL — the one rhythmic idea a section is built from.
//
// The Organism had no cohesion, and this is why: every player invented its own
// idea. The drums ran a fixed genre skeleton, the bass ran a fixed [0, 8]
// pattern that ignored the drums entirely, the chords drew a motif from the key
// `chord:<section>:<subgenre>`, and the melody drew a DIFFERENT motif from
// `melody:<section>:<subgenre>`. Different keys mean different seeds mean
// unrelated rhythms. Five soloists who agreed on a key and a tempo, summed
// together. Nobody was listening to anybody.
//
// A band doesn't work like that. A band plays ONE idea, and each player states
// it in their own idiom:
//
//   cell     ▝ x . . x . . x . │ the section's rhythmic thought
//   drums      accents it       (extra kick / open hat on cell slots)
//   bass       lands on it      (onsets chosen FROM the cell)
//   chords     answers it       (comps in the cell's GAPS — call and response)
//   melody     phrases from it  (phrase starts align to cell slots)
//
// Same thought, five voices. That is cohesion, and it is a composition problem,
// not a mix problem — no amount of gain staging can fake it.
//
// The cell is cached per section+sub-genre, so whichever player asks first
// creates it and everyone else gets the SAME one. It is also seeded purely from
// the section (no per-rebuild counter), so it is stable for as long as the
// section lasts — see the locked-loop work: the SECTION is the unit of change.

import { getSectionMotif, type RhythmMotif } from './motif'

export interface SongCell {
  /** The idea: 16th-note slots (0..15) the section's rhythm lives on. */
  slots: number[]
  /** The 2-3 strongest slots — where the idea really lands. */
  accents: number[]
  /** Slots the cell leaves EMPTY. This is where an answering part speaks. */
  gaps: number[]
}

/** One shared key per section — this is the whole point. Do not qualify it per
 *  instrument, or you are back to five separate ideas. */
function cellKey(sectionName: string, subGenre: string): string {
  return `songcell:${sectionName}:${subGenre}`
}

/**
 * The section's rhythmic idea. Every freeplay improviser derives its part from
 * this, so the band states ONE thought instead of five.
 *
 * Cached by section+sub-genre (via the motif store), so the first caller builds
 * it and the rest receive the identical cell. Cleared with clearMotifs().
 */
export function getSongCell(
  sectionName: string,
  subGenre: string,
  rng: () => number,
  density: number,
): SongCell {
  // Always anchor slot 0: the idea has to declare itself on the downbeat, or
  // the section has no centre of gravity.
  const motif: RhythmMotif = getSectionMotif(
    cellKey(sectionName, subGenre),
    rng,
    Math.min(0.6, Math.max(0.25, density)),   // a hook rhythm is a few strong hits, not a wall
    [0],
  )

  const slots = [...motif.slots].sort((a, b) => a - b)

  // Accents: the downbeat plus the two slots furthest from it — the idea's
  // shape is carried by where it leaves the grid, not by how much it fills.
  const accents = [0, ...slots.filter(s => s !== 0).slice(-2)].sort((a, b) => a - b)

  const occupied = new Set(slots)
  const gaps: number[] = []
  for (let s = 0; s < 16; s++) if (!occupied.has(s)) gaps.push(s)

  return { slots, accents, gaps }
}
