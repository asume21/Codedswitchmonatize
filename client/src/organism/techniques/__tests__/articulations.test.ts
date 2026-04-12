import { describe, expect, it } from 'vitest'
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
  sixteenthPos: 2,
}

describe('Articulation library', () => {
  it('registry has the 9 expected articulations', () => {
    expect(ALL_ARTICULATIONS.length).toBe(9)  // none + 4 melody + 4 bass
    const ids = ALL_ARTICULATIONS.map(a => a.id)
    expect(ids).toContain('none')
    expect(ids).toContain('legato-slur')
    expect(ids).toContain('staccato-pop')
    expect(ids).toContain('grace-flick')
    expect(ids).toContain('trill-ornament')
    expect(ids).toContain('bass-slide-up')
    expect(ids).toContain('bass-ghost-note')
    expect(ids).toContain('bass-octave-jump')
    expect(ids).toContain('bass-walking-step')
  })

  it('every articulation id is unique', () => {
    const ids = new Set(ALL_ARTICULATIONS.map(a => a.id))
    expect(ids.size).toBe(ALL_ARTICULATIONS.length)
  })

  it('DEFAULT_ARTICULATION_ID is "none" and resolves', () => {
    expect(DEFAULT_ARTICULATION_ID).toBe('none')
    expect(getArticulation(DEFAULT_ARTICULATION_ID)).toBeDefined()
  })

  it('"none" is an identity pass-through', () => {
    const events = applyArticulation('none', 'C4', '4n', 0.6, stubCtx)
    expect(events.length).toBe(1)
    expect(events[0].note).toBe('C4')
    expect(events[0].duration).toBe('4n')
    expect(events[0].velocity).toBe(0.6)
    expect(events[0].timeOffset).toBe(0)
  })

  it('unknown articulation id falls back to "none"', () => {
    const events = applyArticulation('does-not-exist', 'C4', '4n', 0.6, stubCtx)
    expect(events.length).toBe(1)
    expect(events[0].note).toBe('C4')
  })

  it('legato-slur extends duration and softens velocity', () => {
    const events = applyArticulation('legato-slur', 'C4', '4n', 0.6, stubCtx)
    expect(events.length).toBe(1)
    expect(events[0].velocity).toBeLessThan(0.6)
  })

  it('staccato-pop shortens to 32n', () => {
    const events = applyArticulation('staccato-pop', 'C4', '4n', 0.6, stubCtx)
    expect(events[0].duration).toBe('32n')
  })

  it('grace-flick expands one note into 2 events (grace + main)', () => {
    const events = applyArticulation('grace-flick', 'C4', '4n', 0.6, stubCtx)
    expect(events.length).toBe(2)
    // First event is grace note at negative offset, lower pitch
    expect(events[0].timeOffset).toBeLessThan(0)
    expect(events[0].velocity).toBeLessThan(events[1].velocity)
    // Main note at timeOffset 0
    expect(events[1].timeOffset).toBe(0)
    expect(events[1].note).toBe('C4')
  })

  it('trill-ornament only triggers on downbeats', () => {
    const offbeat = applyArticulation('trill-ornament', 'C4', '4n', 0.6,
      { ...stubCtx, isDownbeat: false })
    const downbeat = applyArticulation('trill-ornament', 'C4', '4n', 0.6,
      { ...stubCtx, isDownbeat: true })
    expect(offbeat.length).toBe(1)  // passthrough
    expect(downbeat.length).toBeGreaterThan(1)  // trill
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
