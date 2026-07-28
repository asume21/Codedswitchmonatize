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

import { getSectionMotif, clearMotifsByPrefix, type RhythmMotif } from './motif'
import { rerollSessionSalt } from './utils'

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

// ── The band's ONE authoritative style ──────────────────────────────────────
// The cohesion bug: each generator built the cell key from its OWN subGenre
// guess — bass fell back to 'boom-bap', others to 'hip-hop', while the conductor
// was on 'chill'. Same section, THREE different cells, three unrelated ideas.
// (Proven live: "section verse now has 3 DIFFERENT cell keys".)
//
// The orchestrator now publishes the single style the whole band is in (from the
// conductor/director state). When set, getSongCell keys off THIS — not the
// caller's argument — so all five generators physically cannot land on different
// cells. A generator's local subGenre still shapes its OWN idiom; it just no
// longer forks the shared idea.
let authoritativeSubGenre: string | null = null

/** Publish the band's current style. Pass '' or null to fall back to per-caller
 *  subGenre (e.g. before the conductor has decided a style). When the style
 *  actually changes, stale-style song cells are dropped so a cell built under
 *  the old style (e.g. a boot-time 'boom-bap' cell) can't linger and split the
 *  section once the real style lands. Stable within a locked section → no
 *  mid-section clear. */
export function setSongCellStyle(subGenre: string | null | undefined): void {
  const next = subGenre && subGenre.length > 0 ? subGenre : null
  if (next === authoritativeSubGenre) return
  authoritativeSubGenre = next
  clearMotifsByPrefix('songcell:')
  // Variety: a genuine style change gets a fresh salt so returning to a style
  // yields a NEW but still-cohesive beat instead of a byte-identical rebuild
  // (the "every lo-fi sounds the same" sameness). rerollSessionSalt() no-ops
  // when a seed is pinned, so a Locked/pinned beat stays reproducible.
  rerollSessionSalt()
}

// ── Sample Leads override ───────────────────────────────────────────────────
// When a loop is the SAMPLE the beat is built around, the loop's own onset
// grid IS the section's rhythmic idea — every improviser derives from the
// sample's bounce instead of an invented motif. Null = normal generated cells.
let sampleCell: SongCell | null = null

/** Install (or clear, with null) the sample's rhythm as THE song cell. */
export function setSampleCell(cell: SongCell | null): void {
  sampleCell = cell
}

export function getSampleCell(): SongCell | null {
  return sampleCell
}

/** Build a SongCell from a loop's analyzed onsetGrid (16 strengths 0..1).
 *  Slots = where the sample actually hits; accents = its strongest hits;
 *  gaps = where an answering part can speak. */
export function cellFromOnsetGrid(onsetGrid: number[]): SongCell {
  const HIT_THRESHOLD = 0.35
  const slots = onsetGrid
    .map((v, i) => (v >= HIT_THRESHOLD ? i : -1))
    .filter((i) => i >= 0)
  if (!slots.includes(0)) slots.unshift(0) // the idea declares itself on the downbeat
  const accents = [...slots]
    .sort((a, b) => (onsetGrid[b] ?? 0) - (onsetGrid[a] ?? 0))
    .slice(0, 3)
    .sort((a, b) => a - b)
  const occupied = new Set(slots)
  const gaps: number[] = []
  for (let s = 0; s < 16; s++) if (!occupied.has(s)) gaps.push(s)
  return { slots: slots.sort((a, b) => a - b), accents, gaps }
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
  // Sample Leads: when a loop is the sample, its bounce IS the idea — for
  // every section, for every player. No generated motif competes with it.
  if (sampleCell) return sampleCell

  // The band's ONE style wins over whatever this caller happened to pass, so
  // every generator resolves to the SAME cell key for the section.
  const style = authoritativeSubGenre ?? subGenre

  // Always anchor slot 0: the idea has to declare itself on the downbeat, or
  // the section has no centre of gravity.
  const motif: RhythmMotif = getSectionMotif(
    cellKey(sectionName, style),
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
