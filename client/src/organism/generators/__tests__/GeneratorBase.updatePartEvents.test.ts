import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createToneMock, mockPartClear, mockPartAdd } from './__mocks__/toneMock'
vi.mock('tone', () => createToneMock())
import * as Tone from 'tone'
import { GeneratorBase } from '../GeneratorBase'

// Minimal concrete subclass so we can reach the protected helper.
class TestGen extends GeneratorBase {
  readonly output = new (Tone as any).Gain()
  processFrame(): void {}
  onStateTransition(): void {}
  reset(): void {}
  stopPart(): void {}
  callUpdate(part: any, events: any[]) { this.updatePartEvents(part, events) }
}

describe('GeneratorBase.updatePartEvents', () => {
  beforeEach(() => { mockPartClear.mockClear(); mockPartAdd.mockClear() })

  it('clears the part once, then adds every event — never disposes', () => {
    const gen = new TestGen('bass' as any)
    const part = new (Tone as any).Part()
    const events = [{ time: '0:0:0' }, { time: '0:1:0' }, { time: '0:2:0' }]

    gen.callUpdate(part, events)

    expect(mockPartClear).toHaveBeenCalledTimes(1)
    expect(mockPartAdd).toHaveBeenCalledTimes(3)
  })
})
