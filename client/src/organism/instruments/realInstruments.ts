import type { InstrumentPerformerProfile } from '../performers/types'

/**
 * Real-instrument registry — bridges the imported note-mapped multisamples
 * (served at /api/loops/instruments) to the performer system, so a performer
 * whose profile names a `realInstrument` plays REAL recorded samples
 * (e.g. Sonatina violins, VCSL Steinway) instead of the thin ~12-sample GM
 * soundfont. Falls back to GM silently when the instrument isn't present.
 *
 * Loaded once per session; generators call getRealInstrumentNotes() inside
 * applyVoice() and pick createMultisampleSampler vs createSoundfontSampler.
 */

interface CatalogInstrument {
  id: string
  family: string
  notes: Record<string, string>
  noteCount: number
}

let notesByInstrumentId: Map<string, Record<string, string>> | null = null
let loadPromise: Promise<void> | null = null

/** Fetch + cache the multisample catalog. Safe to call repeatedly. */
export function loadRealInstruments(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = fetch('/api/loops/instruments')
    .then((r) => (r.ok ? r.json() : { instruments: [] }))
    .then((d) => {
      const list: CatalogInstrument[] = Array.isArray(d.instruments) ? d.instruments : []
      notesByInstrumentId = new Map(list.map((i) => [i.id, i.notes]))
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        console.debug(`[realInstruments] loaded ${list.length} instruments`)
      }
    })
    .catch((err) => {
      console.warn('[realInstruments] catalog load failed', err)
      notesByInstrumentId = new Map()
    })
  return loadPromise
}

/** True once the catalog fetch has resolved (success or failure). */
export function realInstrumentsReady(): boolean {
  return notesByInstrumentId !== null
}

/**
 * Note→URL map for a performer's real instrument, or null if the catalog isn't
 * loaded yet, the performer has no `realInstrument`, or it isn't present on disk.
 */
export function getRealInstrumentNotes(
  performer: Pick<InstrumentPerformerProfile, 'realInstrument'>,
): Record<string, string> | null {
  if (!notesByInstrumentId || !performer.realInstrument) return null
  return notesByInstrumentId.get(performer.realInstrument) ?? null
}
