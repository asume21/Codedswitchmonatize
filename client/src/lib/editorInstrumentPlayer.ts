import * as Tone from 'tone'
import { loadRealInstruments, realInstrumentsReady } from '@/organism/instruments/realInstruments'
import { createMultisampleSampler, type LoadableSampler } from '@/organism/instruments/SamplerUtils'
import { loadOrganismKits, type OrganismKitRole } from '@/organism/instruments/OrganismKitCache'
import { velocityToGain } from '@/organism/generators/SampledDrumKit'
import { getAudioContext } from './audioContext'

/**
 * Plays editor notes on the SAME samples the Organism performed them on.
 *
 * The app had two independent instrument systems. The Organism plays real
 * multisamples (Sonatina/VCSL/SK) and a sampled drum kit; the editor played
 * General MIDI soundfonts and a small synth drum set. Identical notes at
 * identical pitches therefore came back sounding like a different band — the
 * standing "it doesn't sound like the generation" complaint.
 *
 * This does not add a third system. It reuses the Organism's own loaders
 * (`realInstruments` + `createMultisampleSampler`, `loadOrganismKits`) behind an
 * editor-shaped API: one-shot, deterministic, no performance state — no modes,
 * no genre targets, no key tracking.
 *
 * Every entry point returns false when it cannot play the sound, so the caller
 * falls back to the GM path rather than going silent.
 */

// ── Melodic voices ─────────────────────────────────────────────────────────

const samplerCache = new Map<string, LoadableSampler>()
const samplerFailed = new Set<string>()

/** A drum kit id, not a melodic instrument. */
function isKitId(id: string): boolean {
  return id.startsWith('private:') || id.startsWith('bundled:')
}

async function getSampler(instrumentId: string): Promise<LoadableSampler | null> {
  if (samplerFailed.has(instrumentId)) return null
  const cached = samplerCache.get(instrumentId)
  if (cached) return cached

  if (!realInstrumentsReady()) await loadRealInstruments()

  // getRealInstrumentNotes takes a performer profile; the editor only has an id,
  // so ask the catalog for that id directly through the same shape.
  const { getRealInstrumentNotes } = await import('@/organism/instruments/realInstruments')
  const notes = getRealInstrumentNotes({ realInstrument: instrumentId } as any)
  if (!notes || Object.keys(notes).length === 0) {
    samplerFailed.add(instrumentId)   // not a real instrument — GM handles it
    return null
  }

  const sampler = createMultisampleSampler(notes, { attack: 0.01, release: 0.6 }, -6)
  sampler.toDestination()
  samplerCache.set(instrumentId, sampler)
  return sampler
}

// ── Drums ──────────────────────────────────────────────────────────────────

const drumBuffers = new Map<string, AudioBuffer>()
let kitLoad: Promise<void> | null = null

/** StudioNote.drumType → the kit's own role names. */
const DRUM_ROLE: Record<string, OrganismKitRole> = {
  kick: 'kick', snare: 'snare', hihat: 'hat', hat: 'hat',
  perc: 'perc', tom: 'tom', clap: 'snare', crash: 'perc',
}

async function ensureKit(): Promise<void> {
  if (kitLoad) return kitLoad
  kitLoad = (async () => {
    const res = await loadOrganismKits()
    const kit = res?.kits?.find(k => k.id === res.bestKitId) ?? res?.kits?.[0]
    if (!kit) return
    const ctx = getAudioContext()
    if (!ctx) return
    // One sample per role — the first is enough for editor playback; the
    // Organism's round-robin voice pools are a performance feature.
    const seen = new Set<string>()
    await Promise.all(kit.samples.map(async (s) => {
      if (seen.has(s.role)) return
      seen.add(s.role)
      try {
        const r = await fetch(s.url)
        if (!r.ok) return
        drumBuffers.set(s.role, await ctx.decodeAudioData(await r.arrayBuffer()))
      } catch { /* one missing sample must not fail the kit */ }
    }))
  })()
  return kitLoad
}

/** Play one drum hit on the Organism's kit. False when unavailable. */
export async function playEditorDrum(
  drumType: string,
  velocity01: number,
  targetNode?: AudioNode,
): Promise<boolean> {
  const role = DRUM_ROLE[String(drumType).toLowerCase()]
  if (!role) return false
  await ensureKit()
  const buffer = drumBuffers.get(role)
  if (!buffer) return false

  const ctx = getAudioContext()
  if (!ctx) return false
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const gain = ctx.createGain()
  // Same velocity curve the Organism uses, so a captured hit keeps its weight.
  gain.gain.value = velocityToGain(velocity01)
  src.connect(gain)
  gain.connect(targetNode ?? ctx.destination)
  src.start()
  return true
}

/**
 * Play one melodic note on the instrument the Organism used.
 * False when there is no real multisample for it — caller falls back to GM.
 */
export async function playEditorNote(
  note: string,
  octave: number,
  durationSec: number,
  instrumentId: string | undefined,
  velocity01: number,
): Promise<boolean> {
  if (!instrumentId || isKitId(instrumentId)) return false
  const sampler = await getSampler(instrumentId)
  if (!sampler) return false
  try {
    await Tone.loaded()
    sampler.triggerAttackRelease(`${note}${octave}`, durationSec, undefined, Math.max(0.01, velocity01))
    return true
  } catch {
    return false
  }
}

/** Test seam / teardown. */
export function __resetEditorInstruments(): void {
  samplerCache.forEach(s => { try { s.dispose() } catch { /* already gone */ } })
  samplerCache.clear()
  samplerFailed.clear()
  drumBuffers.clear()
  kitLoad = null
}
