// Shared timing helpers for live Organism generators.
//
// The Organism can rebuild parts from several async paths: state transitions,
// chord changes, sub-genre swaps, and AI pattern loads. All rebuilt parts must
// enter on the same transport grid or the beat feels like separate loops rather
// than one composition.

import * as Tone from 'tone'

export const STEPS_PER_BAR = 16
export const DEFAULT_PART_LOOP_BARS = 4
const LIVE_REBUILD_BATCH_WINDOW_MS = 450
const MIN_LIVE_REBUILD_LEAD_SECONDS = 0.25

let cachedLivePartStart: {
  value: Tone.Unit.Time
  createdAtMs: number
} | null = null

export interface ParsedGridTime {
  bar: number
  beat: number
  sub: number
}

export function parseGridTime(time: string): ParsedGridTime {
  const [barRaw, beatRaw, subRaw] = time.split(':')
  return {
    bar: Math.max(0, Math.floor(Number.parseInt(barRaw ?? '0', 10) || 0)),
    beat: Math.max(0, Math.min(3, Math.floor(Number.parseInt(beatRaw ?? '0', 10) || 0))),
    sub: Math.max(0, Math.min(3, Math.round(Number.parseFloat(subRaw ?? '0') || 0))),
  }
}

export function formatGridTime({ bar, beat, sub }: ParsedGridTime): string {
  return `${bar}:${beat}:${sub}`
}

export function quantizeGridTime(time: string, loopBars = DEFAULT_PART_LOOP_BARS): string {
  const [barRaw, beatRaw, subRaw] = time.split(':')
  const rawBar = Math.max(0, Number.parseInt(barRaw ?? '0', 10) || 0)
  const rawBeat = Math.max(0, Number.parseInt(beatRaw ?? '0', 10) || 0)
  const sub = Math.max(0, Number.parseFloat(subRaw ?? '0') || 0)
  const step = Math.round(rawBar * STEPS_PER_BAR + rawBeat * 4 + sub)
  const loopSteps = loopBars * STEPS_PER_BAR
  // Use modulo for clean wrapping within the loop instead of clamping
  const wrappedStep = ((step % loopSteps) + loopSteps) % loopSteps
  const bar = Math.floor(wrappedStep / STEPS_PER_BAR)
  const stepInBar = wrappedStep % STEPS_PER_BAR
  return formatGridTime({
    bar,
    beat: Math.floor(stepInBar / 4),
    sub: stepInBar % 4,
  })
}

export function getLivePartStart(hasStartedPlayback: boolean): Tone.Unit.Time {
  const transport = Tone.getTransport()

  if (!hasStartedPlayback) {
    cachedLivePartStart = null
    return 0
  }

  if (transport.state !== 'started') {
    cachedLivePartStart = null
    return 0
  }

  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()

  // CRITICAL DOMAIN NOTE: we schedule in TICKS ("<n>i" TransportTime), never in
  // transport-seconds. Tone keeps two clocks that disagree after any BPM
  // automation: transport.seconds integrates the bpm curve, but Part.start(<sec>)
  // converts seconds→ticks at the CURRENT bpm only. After a preset swap's
  // bpm.rampTo (e.g. 85→130) every seconds-scheduled part landed ~5–6s late in
  // tick time, and the handoff's wall-clock dispose timer destroyed each part
  // BEFORE its first event fired → permanent silence with sporadic blips
  // (measured live 2026-06-12: a bare Part scheduled at +1.0s fired at +6.35s).
  // Ticks are PPQ-based musical time, immune to bpm history, so the next-downbeat
  // computation stays exact through ramps, swaps, and performer BPM sync.
  const nowTicks = transport.ticks
  const ppq = transport.PPQ
  const ticksPerBar = ppq * 4   // engine-wide 4/4 assumption (matches the rest)

  if (
    cachedLivePartStart &&
    nowMs - cachedLivePartStart.createdAtMs <= LIVE_REBUILD_BATCH_WINDOW_MS
  ) {
    const cachedTicks = ticksFromTransportTime(cachedLivePartStart.value)
    if (cachedTicks === null || cachedTicks - nowTicks > ppq * 0.02) {
      return cachedLivePartStart.value
    }
  }

  // Align to the next downbeat, with a minimum lead so staggered generator
  // rebuilds (drums/bass/melody/chord fire up to ~180ms apart) all land on the
  // SAME downbeat instead of one generator catching this bar and the rest missing.
  const bpm = Math.max(40, Number(transport.bpm.value) || 120)
  const minLeadTicks = MIN_LIVE_REBUILD_LEAD_SECONDS * (bpm / 60) * ppq
  let nextBarTick = (Math.floor(nowTicks / ticksPerBar) + 1) * ticksPerBar
  if (nextBarTick - nowTicks < minLeadTicks) {
    nextBarTick += ticksPerBar
  }
  const startAt: Tone.Unit.Time = `${nextBarTick}i`

  cachedLivePartStart = { value: startAt, createdAtMs: nowMs }
  return startAt
}

/** Parse a "<n>i" ticks TransportTime; null for anything else. */
function ticksFromTransportTime(time: Tone.Unit.Time): number | null {
  if (typeof time === 'string' && time.endsWith('i')) {
    const ticks = Number.parseFloat(time)
    return Number.isFinite(ticks) ? ticks : null
  }
  return null
}

/**
 * Wall-clock milliseconds until a TransportTime boundary. Used by the
 * seamless-handoff dispose timers. Approximate during an active bpm ramp
 * (uses the instantaneous bpm), so callers should pad generously — disposing
 * late is harmless, disposing early kills a part before it ever plays.
 */
export function msUntilTransportTime(time: Tone.Unit.Time): number {
  const transport = Tone.getTransport()
  const ticks = ticksFromTransportTime(time)
  if (ticks !== null) {
    const bpm = Math.max(40, Number(transport.bpm.value) || 120)
    return Math.max(0, ((ticks - transport.ticks) / transport.PPQ) * (60 / bpm) * 1000)
  }
  if (typeof time === 'number') {
    return Math.max(0, (time - transport.seconds) * 1000)
  }
  return 0
}

export function resetLivePartStartCacheForTests(): void {
  cachedLivePartStart = null
}
