// Shared timing helpers for live Organism generators.
//
// The Organism can rebuild parts from several async paths: state transitions,
// chord changes, sub-genre swaps, and AI pattern loads. All rebuilt parts must
// enter on the same transport grid or the beat feels like separate loops rather
// than one composition.

import * as Tone from 'tone'

export const STEPS_PER_BAR = 16
export const DEFAULT_PART_LOOP_BARS = 4

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
  const maxStep = Math.max(0, loopBars * STEPS_PER_BAR - 1)
  const clampedStep = Math.max(0, Math.min(maxStep, step))
  const bar = Math.floor(clampedStep / STEPS_PER_BAR)
  const stepInBar = clampedStep % STEPS_PER_BAR
  return formatGridTime({
    bar,
    beat: Math.floor(stepInBar / 4),
    sub: stepInBar % 4,
  })
}

export function getLivePartStart(hasStartedPlayback: boolean): Tone.Unit.Time {
  const transport = Tone.getTransport()

  if (!hasStartedPlayback) {
    return 0
  }

  if (transport.state !== 'started') {
    return 0
  }

  // Rebuilds align to the next measure while playing. This prevents staggered
  // generator rebuilds from entering on different 16ths, while first starts
  // stay immediately active against the current transport position.
  return transport.nextSubdivision('1m')
}
