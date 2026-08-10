/**
 * csbl-lexer.ts
 * Tokenizer for CSBL patterns.
 * - Token types: DRUM_SYM (single-char), NOTE (e.g., c4, d#4), CHORD (Roman degree or placeholder), OP (>, ~, *)
 * - Step model: 1 step = one 16th; bar = 16 steps
 */

export type Token =
  | { type: "DRUM_SYM"; value: string; index: number }
  | { type: "NOTE"; value: string; index: number }
  | { type: "CHORD"; value: string; index: number }
  | { type: "OP"; value: string; index: number }
  | { type: "REST"; value: "-" ; index: number };

const DRUM_CHARS = new Set(["x","s","t","p","-","*","~",">"]);
/** Bass adds 'b' as a HIT symbol (CSBL Section 5). */
const BASS_CHARS = new Set(["b","-","*","~",">"]);

/**
 * Roles whose patterns use single-character hit symbols.
 * Melody and chord patterns are token-based (note names, Roman degrees) instead.
 */
const BASS_ROLES = new Set(["bass"]);

/**
 * Tokenize a pattern. ROLE IS REQUIRED for anything but drums, because the
 * grammar is genuinely ambiguous without it:
 *
 *   'b' is a BASS HIT in a bass pattern  ("b--b-b--")
 *   'b' is a FLAT in a melody pattern    ("bb4" = B-flat-4)
 *
 * A context-free lexer cannot resolve that. Without the role, every bass pattern
 * in the spec's own training data threw `Unknown token at index 0: 'b'` — measured
 * 2026-08-10 against all seven pattern shapes in Section 9.
 */
export function tokenizePattern(pattern: string, role = "hats") {
  if (typeof pattern !== "string") throw new Error("Pattern must be a string");
  const isBass = BASS_ROLES.has(role.toLowerCase());
  const singleChars = isBass ? BASS_CHARS : DRUM_CHARS;
  const tokens: Token[] = [];
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    // Single-char hit/operator/rest for this role
    if (singleChars.has(ch)) {
      if (ch === "-") tokens.push({ type: "REST", value: "-", index: i });
      else if (ch === "*" || ch === "~" || ch === ">") tokens.push({ type: "OP", value: ch, index: i });
      else tokens.push({ type: "DRUM_SYM", value: ch, index: i });
      i += 1;
      continue;
    }

    // Note token: letter [a-g] optionally #/b and octave digits, e.g., c4, d#5
    const noteMatch = pattern.slice(i).match(/^[a-gA-G](?:#|b)?\d+/);
    if (noteMatch) {
      tokens.push({ type: "NOTE", value: noteMatch[0], index: i });
      i += noteMatch[0].length;
      continue;
    }

    // Chord token: Roman numeral or textual chord (we prefer degrees later)
    const chordMatch = pattern.slice(i).match(/^[ivIVM0-9]+(?:7|maj|min|dim|aug)?/);
    if (chordMatch) {
      tokens.push({ type: "CHORD", value: chordMatch[0], index: i });
      i += chordMatch[0].length;
      continue;
    }

    // Unknown char -> error with index
    throw new Error(`Unknown token at index ${i}: '${pattern[i]}'`);
  }

  return tokens;
}
