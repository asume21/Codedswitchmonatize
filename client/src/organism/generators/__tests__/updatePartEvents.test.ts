/**
 * @vitest-environment jsdom
 *
 * HOLD-AND-MUTATE swap (GeneratorBase.updatePartEvents, spec §13).
 *
 * The swap clears a looping Part and re-adds its events so a "rebuild" never
 * disposes/recreates the Part. Its doc comment assumed "new events land at the
 * next iteration" — which only holds if rebuilds are RARER than the loop.
 *
 * They are not. BassGenerator.MIN_REBUILD_INTERVAL_MS is 900ms and its Part
 * loops at '4m' (~10s at 96 BPM), so the bass wiped its whole schedule roughly
 * ten times per loop. A note only ever fired if it happened to fall in the gap
 * between two wipes; everything else was cleared before the Transport reached
 * it. Measured live 2026-08-04: bass channel at -inf while the generator
 * reported on:true and gain 0.95, and bass was the ONLY generator still on this
 * path (the drum/chord/melody rollout was reverted in a70e576e).
 *
 * The bass line is a LOCKED loop, so the overwhelming majority of those rebuilds
 * regenerate byte-identical events. Skipping the swap when nothing changed keeps
 * the schedule intact and costs nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { createToneMock } from './__mocks__/toneMock'

vi.mock('tone', () => createToneMock())

import { GeneratorBase } from '../GeneratorBase'
import { GeneratorName } from '../types'

class TestGenerator extends GeneratorBase {
  constructor() { super(GeneratorName.Bass) }
  processFrame(): void {}
  onStateTransition(): void {}
  reset(): void {}
  stopPart(): void {}
  // Expose the protected swap for the test.
  swap(part: any, events: Array<{ time: string; [k: string]: unknown }>): void {
    this.updatePartEvents(part, events)
  }
}

function fakePart() {
  return { clear: vi.fn(), add: vi.fn() }
}

const LINE = [
  { time: '0:0:0.00', note: 'C1', dur: '8n', vel: 0.9 },
  { time: '1:2:2.00', note: 'G1', dur: '8n', vel: 0.8 },
]

describe('GeneratorBase.updatePartEvents', () => {
  it('schedules the events on the first swap', () => {
    const gen = new TestGenerator()
    const part = fakePart()

    gen.swap(part, LINE)

    expect(part.clear).toHaveBeenCalledOnce()
    expect(part.add).toHaveBeenCalledTimes(LINE.length)
  })

  it('does NOT wipe the schedule when the events are unchanged', () => {
    const gen = new TestGenerator()
    const part = fakePart()

    gen.swap(part, LINE)
    part.clear.mockClear()
    part.add.mockClear()

    // A rebuild 900ms later that produced the identical locked line.
    gen.swap(part, LINE.map(e => ({ ...e })))

    expect(part.clear).not.toHaveBeenCalled()
    expect(part.add).not.toHaveBeenCalled()
  })

  it('still swaps when the line actually changes', () => {
    const gen = new TestGenerator()
    const part = fakePart()

    gen.swap(part, LINE)
    part.clear.mockClear()
    part.add.mockClear()

    const changed = [...LINE, { time: '2:0:0.00', note: 'A1', dur: '8n', vel: 0.7 }]
    gen.swap(part, changed)

    expect(part.clear).toHaveBeenCalledOnce()
    expect(part.add).toHaveBeenCalledTimes(changed.length)
  })

  it('tracks each Part separately', () => {
    const gen = new TestGenerator()
    const a = fakePart()
    const b = fakePart()

    gen.swap(a, LINE)
    gen.swap(b, LINE)   // different Part, same events — must still schedule

    expect(b.clear).toHaveBeenCalledOnce()
    expect(b.add).toHaveBeenCalledTimes(LINE.length)
  })
})
