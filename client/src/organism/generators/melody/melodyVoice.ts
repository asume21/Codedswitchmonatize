import type { InstrumentPerformerId } from '../../performers'

/**
 * Deterministic section -> instrument pick. Lets the lead hand off between
 * sections (piano verse -> strings chorus). Returns null if no voice is available
 * (caller keeps the current voice). Pure: no side effects.
 */
export function assignMelodyVoice(
  section: string,
  seed: number,
  available: InstrumentPerformerId[],
): InstrumentPerformerId | null {
  if (available.length === 0) return null
  let h = seed >>> 0
  for (let i = 0; i < section.length; i++) h = (Math.imul(h, 31) + section.charCodeAt(i)) >>> 0
  return available[h % available.length]
}
