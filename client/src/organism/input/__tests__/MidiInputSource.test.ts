import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MidiInputSource } from '../MidiInputSource'
import type { AnalysisFrame } from '../../analysis/types'

// Stub Web MIDI API
function createMockMIDIAccess(): MIDIAccess {
  const inputs = new Map<string, Partial<MIDIInput>>()
  const mockInput: Partial<MIDIInput> = {
    onmidimessage: null as ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null,
    id: 'test-input',
    name: 'Test MIDI Device',
  }
  inputs.set('test-input', mockInput)

  return {
    inputs: inputs as MIDIInputMap,
    outputs: new Map() as MIDIOutputMap,
    onstatechange: null,
    sysexEnabled: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  } as unknown as MIDIAccess
}

let mockMidiAccess: MIDIAccess

vi.stubGlobal('navigator', {
  ...navigator,
  requestMIDIAccess: vi.fn().mockImplementation(async () => mockMidiAccess),
})

describe('MidiInputSource', () => {
  let source: MidiInputSource

  beforeEach(() => {
    vi.useFakeTimers()
    mockMidiAccess = createMockMIDIAccess()
    source = new MidiInputSource()
  })

  afterEach(() => {
    source.stop()
    vi.useRealTimers()
  })

  it('isRunning() is false before start()', () => {
    expect(source.isRunning()).toBe(false)
  })

  it('isRunning() is true after start()', async () => {
    await source.start()
    expect(source.isRunning()).toBe(true)
  })

  it('emits frames on fixed interval after start()', async () => {
    const frames: AnalysisFrame[] = []
    source.subscribe((frame) => frames.push(frame))

    await source.start()
    vi.advanceTimersByTime(100)

    expect(frames.length).toBeGreaterThan(0)
  })

  it('frames have valid AnalysisFrame structure', async () => {
    let lastFrame: AnalysisFrame | null = null
    source.subscribe((f) => { lastFrame = f })

    await source.start()
    vi.advanceTimersByTime(50)

    expect(lastFrame).not.toBeNull()
    const f = lastFrame!
    expect(f.sampleRate).toBe(44100)
    expect(typeof f.rms).toBe('number')
    expect(typeof f.pitch).toBe('number')
    expect(typeof f.voiceActive).toBe('boolean')
    expect(typeof f.onsetDetected).toBe('boolean')
  })

  it('getLastFrame() returns null before any emission', () => {
    expect(source.getLastFrame()).toBeNull()
  })

  it('stop() halts emission', async () => {
    const frames: AnalysisFrame[] = []
    source.subscribe((f) => frames.push(f))

    await source.start()
    vi.advanceTimersByTime(50)
    const count = frames.length

    source.stop()
    vi.advanceTimersByTime(200)
    expect(frames.length).toBe(count)
    expect(source.isRunning()).toBe(false)
  })

  it('unsubscribe stops callbacks for that subscriber', async () => {
    const frames: AnalysisFrame[] = []
    const unsub = source.subscribe((f) => frames.push(f))

    await source.start()
    vi.advanceTimersByTime(50)
    unsub()
    const count = frames.length

    vi.advanceTimersByTime(100)
    expect(frames.length).toBe(count)
  })
})
