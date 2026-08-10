/**
 * csblToOrganism.ts — the bridge from CSBL text to something the band actually plays.
 *
 * A music language you cannot hear cannot be judged, and until this existed CSBL
 * compiled to `DrumHit[]` that nothing consumed. This is deliberately the THINNEST
 * possible bridge:
 *
 *     CSBL string -> parse -> DrumHit[] -> DrumGenerator.loadGeneratedPattern()
 *
 * It schedules NOTHING. It creates no Tone.Part, never touches Tone.Transport, and
 * owns no clock. The DrumGenerator keeps playing the hits exactly as it plays the
 * improviser's — CSBL just decides what they are. That is what keeps this a front
 * end rather than the second scheduler this repo keeps growing (spec 13.7).
 */

import type { DrumHit } from '../generators/types'
import { parseCSBL } from './csbl-parser'
import { compileDrumBlockToHits } from './csbl-compiler-drums'
import { bassPatternToHits } from './csbl-compiler-bass'

export interface CsblCompileResult {
  ok: boolean
  hits: DrumHit[]
  /** Human-readable reason, with the offending index where the parser gave one. */
  error?: string
  role?: string
  vibe?: string
  genre?: string
}

/** Roles this slice can actually sound. Anything else fails LOUDLY rather than
 *  quietly producing nothing (spec 13.7 #2 — three AI paths in this repo already
 *  swallow their own errors and leave behaviour that looks fine and is not). */
const PLAYABLE_ROLES = new Set(['hats', 'kick', 'snare', 'perc'])
const BASS_ROLES = new Set(['bass'])

/** A bass step: WHEN and how hard, never which note. The Conductor supplies the
 *  pitch at build time so CSBL cannot become a second harmonic authority (13.6). */
export interface CsblBassStep {
  time: string
  velocity: number
  glide?: boolean
  sustain?: boolean
}

export type CsblAudition =
  | { ok: true; kind: 'drums'; hits: DrumHit[]; role: string; vibe?: string; genre?: string }
  | { ok: true; kind: 'bass'; steps: CsblBassStep[]; role: string; vibe?: string; genre?: string }
  | { ok: false; error: string; role?: string }

/**
 * Compile any CSBL line, routed by role. One entry point so the caller does not
 * have to know in advance whether a vibe is a drum or a bass pattern — which is
 * what the vibe BUTTONS need, since the user just clicks a name.
 */
export function compileCsbl(source: string): CsblAudition {
  try {
    const block = parseCSBL(source)
    const role = block.role
    if (!block.pattern) return { ok: false, role, error: 'No pattern — expected >> "…"' }

    if (BASS_ROLES.has(role)) {
      const steps = bassPatternToHits(block.pattern)
      if (steps.length === 0) return { ok: false, role, error: 'Pattern produced zero bass hits' }
      return { ok: true, kind: 'bass', steps, role, vibe: block.vibe, genre: block.genre }
    }

    if (PLAYABLE_ROLES.has(role)) {
      const hits = compileDrumBlockToHits({ role, pattern: block.pattern })
      if (hits.length === 0) return { ok: false, role, error: 'Pattern produced zero hits' }
      return { ok: true, kind: 'drums', hits, role, vibe: block.vibe, genre: block.genre }
    }

    return {
      ok: false,
      role,
      error: `Role "${role}" is not playable yet. Supported: ` +
             `${[...PLAYABLE_ROLES, ...BASS_ROLES].join(', ')}.`,
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Compile one CSBL line to drum hits. Never throws — returns a typed result, because
 * the caller is usually a console/UI audition where an exception is a worse
 * experience than a message. Internal errors are still surfaced verbatim.
 */
export function compileCsblToDrumHits(source: string): CsblCompileResult {
  try {
    const block = parseCSBL(source)
    if (!PLAYABLE_ROLES.has(block.role)) {
      return {
        ok: false,
        hits: [],
        role: block.role,
        error: `Role "${block.role}" is not playable in the drum slice. ` +
               `Supported: ${[...PLAYABLE_ROLES].join(', ')}.`,
      }
    }
    if (!block.pattern) {
      return { ok: false, hits: [], role: block.role, error: 'No pattern — expected >> "…"' }
    }
    const hits = compileDrumBlockToHits({ role: block.role, pattern: block.pattern })
    if (hits.length === 0) {
      return { ok: false, hits: [], role: block.role, error: 'Pattern produced zero hits' }
    }
    return { ok: true, hits, role: block.role, vibe: block.vibe, genre: block.genre }
  } catch (e) {
    return { ok: false, hits: [], error: (e as Error).message }
  }
}
