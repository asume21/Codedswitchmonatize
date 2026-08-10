/**
 * csbl-chords-degrees.ts
 * - Parses chord tokens expressed as Roman numerals (i, II, iv, V7, etc.)
 * - Returns a structured degree object for the Conductor to resolve
 */

export type ChordDegree = {
  degree: string;
  quality?: string;
  index: number;
};

const romanRe = /^([ivIV]+)(7|maj|min|dim|aug)?/;

export function parseChordToken(token: string, index = 0): ChordDegree {
  if (typeof token !== "string" || token.length === 0) throw new Error("Empty chord token");
  const m = token.match(romanRe);
  if (!m) throw new Error(`Invalid chord degree token '${token}' at index ${index}`);
  return { degree: m[1], quality: m[2] || undefined, index };
}

export function parseChordPattern(pattern: string) {
  if (!pattern) throw new Error("Empty chord pattern");
  const tokens: ChordDegree[] = [];
  const tokenRe = /[ivIV]+(?:7|maj|min|dim|aug)?/g;
  let m;
  while ((m = tokenRe.exec(pattern)) !== null) {
    tokens.push(parseChordToken(m[0], m.index));
  }
  if (tokens.length === 0) throw new Error("No chord degree tokens found");
  return tokens;
}
