/**
 * csbl-compiler-bass.ts
 * - Pure functions
 * - Compiles bass patterns into BassHit[] for one bar
 * - Step model: 1 char = 1 sixteenth; bar = 16 steps
 * - Operators:
 *    >  = glide/slide flag (map to generator glide rate)
 *    ~  = sustain (extend previous note)
 *    *  = subdivision (micro-roll)
 */

export type BassHit = {
  time: string;
  note?: string;
  velocity: number;
  glide?: boolean;
  sustain?: boolean;
};

import { stepToTime, normalizeToBar } from './csbl-time'


export function bassPatternToHits(pattern: string, barIndex = 0): BassHit[] {
  const { full, grid } = normalizeToBar(pattern);
  const hits: BassHit[] = [];
  let lastHitIndex = -1;

  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    const time = stepToTime(barIndex, i, grid);

    if (ch === "-") continue;
    if (ch === "*") {
      if (lastHitIndex >= 0) {
        const prev = hits[hits.length - 1];
        hits.push({ time, note: prev.note, velocity: Math.max(0.1, prev.velocity * 0.6) });
      } else {
        throw new Error(`'*' at index ${i} has no previous hit to subdivide`);
      }
      continue;
    }
    if (ch === "~") {
      if (lastHitIndex >= 0) {
        hits[lastHitIndex].sustain = true;
        continue;
      } else {
        throw new Error(`'~' at index ${i} has no previous hit to sustain`);
      }
    }
    if (ch === ">") {
      if (lastHitIndex >= 0) {
        hits[lastHitIndex].glide = true;
        continue;
      } else {
        throw new Error(`'>' at index ${i} has no previous hit to glide`);
      }
    }

    if (ch === "b") {
      hits.push({ time, velocity: 0.9 });
      lastHitIndex = hits.length - 1;
      continue;
    }

    throw new Error(`Unknown bass symbol '${ch}' at index ${i}`);
  }

  return hits;
}

export function compileBassBlockToHits(block: { role: string; pattern?: string }) {
  const bassRoles = ["bass"];
  if (!bassRoles.includes(block.role)) throw new Error("Role not supported in bass slice");
  if (!block.pattern) throw new Error("No pattern provided");
  return bassPatternToHits(block.pattern, 0);
}
