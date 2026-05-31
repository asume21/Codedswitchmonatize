import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  ALL_ARTICULATIONS,
  ARTICULATIONS_BY_ID,
  getArticulation,
  DEFAULT_ARTICULATION_ID,
  applyArticulation,
  defaultMelodyArticulation,
  defaultBassArticulation,
  MODE_DEFAULT_MELODY_ARTICULATION,
  MODE_DEFAULT_BASS_ARTICULATION,
} from '../articulations'
import type { ArticulationContext } from '../types'

const stubCtx: ArticulationContext = {
  tempo: 90,
  energy: 0.5,
  isDownbeat: false,
  sixteenthPos: 0, // Changed to 0 for easier beat testing
}

describe('Articulation library', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // Force probability to pass
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registry has the expected articulations', () => {
    expect(ALL_ARTICULATIONS.length).toBe(19)  // none + 9 melody + 9 bass
    // ... existing checks ...
  })
  // ... rest of file ...
  it('new melody articulations add audible variants in appropriate context', () => {
    // scoop-up requires strong beat (sixteenthPos % 4 === 0)
    expect(applyArticulation('scoop-up', 'C4', '4n', 0.6, { ...stubCtx, sixteenthPos: 0 }).length).toBe(2)
    // fall-off requires phrase end (sixteenthPos >= 12)
    expect(applyArticulation('fall-off', 'C4', '4n', 0.6, { ...stubCtx, sixteenthPos: 12 }).length).toBe(2)
    // double-tap requires strong beat
    expect(applyArticulation('double-tap', 'C4', '4n', 0.6, { ...stubCtx, sixteenthPos: 0 }).length).toBe(2)
    // Echoes just need probability (mocked to 0.1)
    expect(applyArticulation('octave-echo', 'C4', '4n', 0.6, stubCtx).length).toBe(2)
    expect(applyArticulation('delayed-echo', 'C4', '4n', 0.6, stubCtx).length).toBe(2)
  })

  it('bass-slide-up prepends a glide note at negative offset', () => {
    const events = applyArticulation('bass-slide-up', 'E2', '4n', 0.7, stubCtx)
    expect(events.length).toBe(2)
    expect(events[0].timeOffset).toBeLessThan(0)
    expect(events[0].velocity).toBeLessThan(events[1].velocity)
  })

  it('bass-ghost-note only adds ghost on off-16ths', () => {
    const onBeat = applyArticulation('bass-ghost-note', 'E2', '4n', 0.7,
      { ...stubCtx, sixteenthPos: 0 })
    const offBeat = applyArticulation('bass-ghost-note', 'E2', '4n', 0.7,
      { ...stubCtx, sixteenthPos: 3 })
    expect(onBeat.length).toBe(1)      // no ghost on downbeat
    expect(offBeat.length).toBe(2)     // ghost + main
  })

  it('bass-octave-jump only doubles on downbeats', () => {
    const offbeat = applyArticulation('bass-octave-jump', 'E2', '4n', 0.7,
      { ...stubCtx, isDownbeat: false })
    const downbeat = applyArticulation('bass-octave-jump', 'E2', '4n', 0.7,
      { ...stubCtx, isDownbeat: true })
    expect(offbeat.length).toBe(1)
    expect(downbeat.length).toBe(2)
  })

  it('bass-walking-step adds pass note only on strong 8th beats', () => {
    const strong = applyArticulation('bass-walking-step', 'E2', '4n', 0.7,
      { ...stubCtx, sixteenthPos: 0 })
    const weak = applyArticulation('bass-walking-step', 'E2', '4n', 0.7,
      { ...stubCtx, sixteenthPos: 1 })
    expect(strong.length).toBe(2)
    expect(weak.length).toBe(1)
  })

  it('new bass articulations add audible variants in appropriate context', () => {
    // pickup requires sixteenthPos % 8 === 0
    expect(applyArticulation('bass-pickup', 'E2', '4n', 0.7, { ...stubCtx, sixteenthPos: 0 }).length).toBe(2)
    // muted-pulse requires sixteenthPos % 4 !== 0
    expect(applyArticulation('bass-muted-pulse', 'E2', '4n', 0.7, { ...stubCtx, sixteenthPos: 2 }).length).toBe(2)
    // octave-walk requires sixteenthPos 8 or 14
    expect(applyArticulation('bass-octave-walk', 'E2', '4n', 0.7, { ...stubCtx, sixteenthPos: 8 }).length).toBe(2)
    // drop-slide requires downbeat
    expect(applyArticulation('bass-drop-slide', 'E2', '4n', 0.7, { ...stubCtx, isDownbeat: true }).length).toBe(2)
    expect(applyArticulation('bass-dub-sustain', 'E2', '4n', 0.7, stubCtx).length).toBe(1)
  })

  it('mode defaults map to valid articulation ids', () => {
    const modes = ['heat', 'ice', 'smoke', 'gravel', 'glow']
    for (const m of modes) {
      expect(getArticulation(MODE_DEFAULT_MELODY_ARTICULATION[m])).toBeDefined()
      expect(getArticulation(MODE_DEFAULT_BASS_ARTICULATION[m])).toBeDefined()
    }
  })

  it('defaultXArticulation("unknown") returns "none"', () => {
    expect(defaultMelodyArticulation('unknown')).toBe('none')
    expect(defaultBassArticulation('unknown')).toBe('none')
  })

  it('ARTICULATIONS_BY_ID exposes the registry for UI consumption', () => {
    expect(ARTICULATIONS_BY_ID.size).toBe(ALL_ARTICULATIONS.length)
  })
})
