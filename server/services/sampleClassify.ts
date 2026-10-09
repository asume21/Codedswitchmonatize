/**
 * Re-file "other" samples from words already in their filenames.
 *
 * 46% of the catalog (880 files) sat in "other" although most names say what
 * they are (snr, tom, clap, crash, k1close…) — product review L6. Only
 * unambiguous tokens move a sample; anything unclear stays "other", and a
 * sample that already has a real type is never changed. The local-samples
 * pack generator picks a random kick/snare/hihat by type, so a wrong move
 * would put the wrong drum in a slot — hence conservative rules.
 */
export type SampleType = 'kick' | 'snare' | 'hihat' | 'loop' | 'percussion' | 'other';

const RULES: Array<[RegExp, SampleType]> = [
  [/(^|[^a-z])(snr|snare)/, 'snare'],
  [/(^|[^a-z])(kick|kik)|(^|[^a-z])k\d+(close|room)/, 'kick'],
  [/(^|[^a-z])(hat|hh|hihat)/, 'hihat'],
  [/(^|[^a-z])(tom|clap|rim|side|flam|crash|ride|china|splash|trash|cym|cowbell|shaker|tamb|conga|bongo)/, 'percussion'],
];

export function classifySampleFilename(filename: string, current: string): string {
  if (current !== 'other') return current;
  const name = filename.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/^other_/, '');
  for (const [re, type] of RULES) if (re.test(name)) return type;
  return 'other';
}
