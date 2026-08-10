/**
 * csbl-compiler-drums.ts
 * Compiles drum patterns into DrumHit[].
 * - Pure functions
 * - 1 char = 1 sixteenth; bar = 16 steps
 * - Shorter patterns tile to fill 16 steps; non-divisors are errors
 * - Implements *, >, ~ semantics minimally for drums
 */

// Import the REAL enum rather than declaring a parallel type. The enum's values are
// lowercase ('kick', 'snare', 'hat', 'perc') and DrumGenerator switches on them, so a
// local `"Kick" | "Snare" | ...` union compiles fine and then silently matches nothing
// downstream. Spec Section 13.4.
import { DrumInstrument, type DrumHit } from '../generators/types'
import { BAR_STEPS, stepToTime, normalizeToBar } from './csbl-time'

export { DrumInstrument }
export type { DrumHit }

/**
 * Map a single-char drum symbol to instrument and default velocity.
 *
 * Symbols are fixed by CSBL Section 5: x = kick, s = snare, t = hat, p = perc.
 * Hat velocity must stay at or below OPEN_HAT_VELOCITY_SPLIT (0.55) or the kit
 * voices the OPEN sample — open vs closed is chosen by velocity, not by symbol.
 */
function mapDrumChar(ch: string): { instrument: DrumInstrument; velocity: number } {
  switch (ch) {
    case "x": return { instrument: DrumInstrument.Kick,  velocity: 0.9 };
    case "s": return { instrument: DrumInstrument.Snare, velocity: 0.85 };
    case "t": return { instrument: DrumInstrument.Hat,   velocity: 0.5 };
    case "p": return { instrument: DrumInstrument.Perc,  velocity: 0.6 };
    default: throw new Error(`Unknown drum char '${ch}'`);
  }
}


/**
 * Convert a raw pattern string (drum role) into DrumHit[] for one bar.
 * Throws on invalid pattern length or unknown symbols.
 */
export function drumPatternToDrumHits(pattern: string, barIndex = 0): DrumHit[] {
  const { full, grid } = normalizeToBar(pattern);
  const hits: DrumHit[] = [];
  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    const time = stepToTime(barIndex, i, grid);

    if (ch === "-") continue;
    if (ch === "*") {
      // Subdivide the PREVIOUS hit — a roll on whatever is actually playing.
      // This used to emit two hardcoded Hat hits regardless of role, so "x*x*"
      // in a KICK pattern produced hi-hats.
      const prev = hits[hits.length - 1];
      if (!prev) throw new Error(`'*' at index ${i} has no previous hit to subdivide`);
      hits.push({ instrument: prev.instrument, time, velocity: Math.max(0.1, prev.velocity * 0.6) });
      continue;
    }
    if (ch === "~") {
      // sustain: no new hit; consumer should extend previous note
      continue;
    }
    if (ch === ">") {
      // slide operator on drums is a no-op; treat as accent for previous hit if exists
      const last = hits[hits.length - 1];
      if (last) last.velocity = Math.min(1, last.velocity + 0.05);
      continue;
    }

    // Standard drum char
    const mapped = mapDrumChar(ch);
    hits.push({ instrument: mapped.instrument, time, velocity: mapped.velocity });
  }

  return hits;
}

/**
 * Top-level compile function for drum roles.
 * Accepts a CSBL block object with pattern string and returns DrumHit[].
 */
export function compileDrumBlockToHits(block: { role: string; pattern?: string }) : DrumHit[] {
  const drumRoles = ["hats", "kick", "snare", "perc"];
  if (!drumRoles.includes(block.role)) throw new Error("Role not supported in drum slice");
  if (!block.pattern) throw new Error("No pattern provided");
  return drumPatternToDrumHits(block.pattern, 0);
}
