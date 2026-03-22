/**
 * Shared syllable counter using vowel cluster heuristic.
 * Not perfect, but fast and good enough for real-time cadence estimation.
 *
 * Used by: CadenceLock, FreestyleReportCard
 */
export function countSyllables(text: string): number {
  const cleaned = text.toLowerCase().replace(/[^a-z\s]/g, '').trim()
  if (!cleaned) return 0

  const words = cleaned.split(/\s+/)
  let total = 0

  for (const w of words) {
    if (w.length <= 2) {
      total += 1
      continue
    }

    // Count vowel groups
    const vowelGroups = w.match(/[aeiouy]+/g)
    let count = vowelGroups ? vowelGroups.length : 1

    // Subtract silent e at end
    if (w.endsWith('e') && count > 1) count--

    // At minimum 1 syllable per word
    total += Math.max(1, count)
  }

  return total
}
