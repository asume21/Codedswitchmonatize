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

  // CRITICAL DOMAIN NOTE: Tone.Part.start()/stop() interpret a numeric time as a
  // TransportTime — seconds along the Transport's own timeline (transport.seconds) —
  // NOT an AudioContext time (Tone.now()). transport.nextSubdivision() returns an
  // AudioContext-absolute time, so feeding its result to Part.start() schedules the
  // part (transport.seconds − context.now) seconds away. Once the Transport has been
  // running for a while those clocks diverge by tens of seconds, so every rebuilt
  // part was scheduled far in the transport future and NEVER fired — the beat played
  // its first loop, then went silent on the next rebuild ("starts then silence").
  // We therefore compute the next measure boundary in the Transport's seconds domain.
  const nowTransport = transport.seconds
  if (
    cachedLivePartStart &&
    nowMs - cachedLivePartStart.createdAtMs <= LIVE_REBUILD_BATCH_WINDOW_MS
  ) {
    const cached = cachedLivePartStart.value
    if (typeof cached !== 'number' || cached - nowTransport > 0.05) {
      return cached
    }
  }

  // Align to the next downbeat. We derive the time-to-next-bar from the MUSICAL
  // position (transport.position = "bars:quarters:sixteenths") rather than from
  // raw elapsed seconds, because the two diverge whenever BPM changes mid-session
  // (preset swaps, performer-BPM sync, tempo ramps). Quantizing raw seconds with
  // Math.ceil(seconds / secondsPerBar) then lands OFF the bar grid — the handoff
  // schedules the new part essentially "now"/in the past and cuts the old one,
  // producing the intermittent gaps/silence. Position fraction + current BPM gives
  // the true remaining time to the next downbeat regardless of tempo history, and
  // the result stays in the Transport seconds domain (so Part.start()/stop() and
  // the generators' `startAt − transport.seconds` dispose timers stay correct).
  const bpm = Math.max(40, Number(transport.bpm.value) || 120)
  const secondsPerBar = (60 / bpm) * 4
  const posParts = String(transport.position).split(':')
  const quarters   = Number.parseFloat(posParts[1] ?? '0') || 0   // 0–3
  const sixteenths = Number.parseFloat(posParts[2] ?? '0') || 0   // 0–3.999
  const fractionIntoBar = (quarters + sixteenths / 4) / 4          // 0–1
  let secondsToNextBar = (1 - fractionIntoBar) * secondsPerBar
  // If the next downbeat is too close, push one bar later so staggered generator
  // rebuilds (drums/bass/melody/chord fire up to ~180ms apart) all land on the
  // SAME downbeat instead of one generator catching this bar and the rest missing.
  if (secondsToNextBar < MIN_LIVE_REBUILD_LEAD_SECONDS) {
    secondsToNextBar += secondsPerBar
  }
  const startAt = nowTransport + secondsToNextBar

  cachedLivePartStart = { value: startAt, createdAtMs: nowMs }
  return startAt
}

export function resetLivePartStartCacheForTests(): void {
  cachedLivePartStart = null
}
