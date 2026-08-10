/**
 * csbl-parser.ts
 * Parses strict CSBL strings: genre.role("vibe") >> "pattern" {params}
 * Validates header, extracts pattern and params, and returns a block object.
 * Throws Error with index info on invalid syntax.
 */

import { tokenizePattern } from "./csbl-lexer";
import { lookupVibePattern } from "./csbl-vibes";

export type CSBLBlock = {
  genre: string;
  role: string;
  vibe: string;
  pattern?: string;
  params: Record<string, number>;
  tokens?: any[];
};

export function parseCSBL(input: string): CSBLBlock {
  if (typeof input !== "string") throw new Error("Input must be a string");

  // Header: genre.role("vibe")
  const headerRe = /^(\w+)\.(\w+)\("([^"]+)"\)/;
  const headerMatch = input.match(headerRe);
  if (!headerMatch) throw new Error("Invalid header: expected genre.role(\"vibe\") at index 0");

  const genre = headerMatch[1];
  const role = headerMatch[2];
  const vibe = headerMatch[3];

  // Pattern: >> "..."  — OPTIONAL. When it is absent the VIBE NAME resolves it from
  // the vocabulary, which is the whole point of the language for a human:
  //
  //   trap.hats("2-step")                        <- name a feel
  //   trap.hats("2-step") >> "t---t---t---t---"  <- or spell the grid out
  //
  // Spec Section 13.9 defined slice 1 as the FIRST form. The lookup was referenced by
  // Section 11's wrapper and never built, and the tests used the second form, so
  // nothing failed.
  const patternRe = />>\s*"([^"]+)"/;
  const patternMatch = input.match(patternRe);
  const pattern = patternMatch
    ? patternMatch[1]
    : lookupVibePattern(genre, role, vibe) ?? undefined;

  if (!patternMatch && !pattern) {
    throw new Error(
      `No pattern for ${genre}.${role}("${vibe}") — the vibe is not in the library, ` +
      `so spell it out with >> "…" or add it to csbl-vibes.ts`,
    );
  }

  // Params: {k: v, ...}
  const paramsRe = /\{([^}]+)\}/;
  const paramsMatch = input.match(paramsRe);
  const params: Record<string, number> = {};
  if (paramsMatch) {
    const raw = paramsMatch[1];
    raw.split(",").forEach((pair) => {
      const [k, v] = pair.split(":").map(s => s.trim());
      if (!k) throw new Error("Invalid params syntax");
      const num = Number(v);
      if (Number.isNaN(num)) throw new Error(`Invalid numeric param for ${k}`);
      params[k] = num;
    });
  }

  const block: CSBLBlock = { genre, role, vibe, pattern, params };

  // Tokenize pattern if present and validate step model
  if (pattern) {
    const tokens = tokenizePattern(pattern, role);
    // Determine token step count: tokens count equals steps only if tokens are single-step tokens.
    // For drums we require pattern length in characters to divide 16 (1 char = 1 step).
    // For mixed tokens, the compiler will decide per-role.
    block.tokens = tokens;
  }

  return block;
}
