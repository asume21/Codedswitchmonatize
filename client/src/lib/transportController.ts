/**
 * transportController — single point of indirection for Tone.Transport.start/stop.
 *
 * Background: two places used to call Tone.Transport.start/stop directly —
 * TransportContext (studio) and GeneratorOrchestrator (Organism, anywhere).
 * Only TransportContext stopped it; the orchestrator deliberately did not, so
 * the clock could be ticking with no one accountable. See
 * project_audio_clock_ownership memory.
 *
 * This module lets any owner register itself as the single Transport caller.
 * Default behavior (no owner) falls back to calling Tone.Transport directly,
 * which preserves existing behavior on pages where TransportContext isn't
 * mounted (e.g. /organism guest page today).
 *
 * Usage:
 *   - TransportContext registers on mount, deregisters on unmount.
 *   - GeneratorOrchestrator calls requestStart() / requestStop() instead of
 *     touching Tone.Transport directly.
 */
import * as Tone from 'tone'

interface TransportOwner {
  start: () => void | Promise<void>
  stop: () => void
}

let currentOwner: TransportOwner | null = null

const defaultOwner: TransportOwner = {
  start: () => {
    const t = Tone.getTransport()
    if (t.state !== 'started') t.start()
  },
  stop: () => {
    const t = Tone.getTransport()
    if (t.state !== 'stopped') t.stop()
  },
}

export function registerTransportOwner(owner: TransportOwner): () => void {
  currentOwner = owner
  return () => {
    if (currentOwner === owner) currentOwner = null
  }
}

export async function requestTransportStart(): Promise<void> {
  await (currentOwner ?? defaultOwner).start()
}

export function requestTransportStop(): void {
  (currentOwner ?? defaultOwner).stop()
}

export function hasTransportOwner(): boolean {
  return currentOwner !== null
}
