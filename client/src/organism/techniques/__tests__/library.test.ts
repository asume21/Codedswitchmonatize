import { describe, expect, it } from 'vitest'
import {
  ALL_TECHNIQUES,
  TECHNIQUES_BY_ID,
  getTechnique,
  DEFAULT_TECHNIQUE_ID,
  techniquesForFamily,
  defaultTechniqueForMode,
  MODE_DEFAULT_TECHNIQUE,
} from '../library'
import type { TechniqueContext } from '../types'
import { OrganismMode } from '../../physics/types'

const stubCtx: TechniqueContext = {
  barIndex: 0,
  beatPosition: 0,
  swing: 0,
  energy: 0.5,
  mode: OrganismMode.Smoke,
  tempo: 90,
  chordDurationSec: 2.0,  // 1 bar at 90 BPM ≈ 2.67s; use 2 for round numbers
}

describe('Chord technique library', () => {
  it('registry contains all techniques and lookups work', () => {
    expect(ALL_TECHNIQUES.length).toBeGreaterThanOrEqual(20)
    for (const t of ALL_TECHNIQUES) {
      expect(getTechnique(t.id)).toBe(t)
      expect(TECHNIQUES_BY_ID.get(t.id)).toBe(t)
    }
  })

  it('DEFAULT_TECHNIQUE_ID is registered', () => {
    expect(getTechnique(DEFAULT_TECHNIQUE_ID)).toBeDefined()
  })

  it('every technique id is unique', () => {
    const ids = new Set(ALL_TECHNIQUES.map(t => t.id))
    expect(ids.size).toBe(ALL_TECHNIQUES.length)
  })

  it('every technique has at least one family and a scheduler', () => {
    for (const t of ALL_TECHNIQUES) {
      expect(t.family.length).toBeGreaterThan(0)
      expect(typeof t.schedule).toBe('function')
    }
  })

  it('piano-block-chord → all notes at timeOffset=0', () => {
    const t = getTechnique('piano-block-chord')!
    const events = t.schedule(['C4', 'E4', 'G4'], stubCtx)
    expect(events.length).toBe(3)
    expect(events.every(e => e.timeOffset === 0)).toBe(true)
  })

  it('piano-rolled-chord → bottom note first, strictly ascending offsets', () => {
    const t = getTechnique('piano-rolled-chord')!
    const events = t.schedule(['C4', 'E4', 'G4'], stubCtx)
    expect(events[0].note).toBe('C4')
    expect(events[0].timeOffset).toBe(0)
    expect(events[1].timeOffset).toBeGreaterThan(events[0].timeOffset)
    expect(events[2].timeOffset).toBeGreaterThan(events[1].timeOffset)
  })

  it('guitar-strum-down → low strings louder (bass-heavy velocity)', () => {
    const t = getTechnique('guitar-strum-down')!
    const events = t.schedule(['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], stubCtx)
    // Low (first) note should have higher velocity than top
    expect(events[0].velocity).toBeGreaterThan(events[events.length - 1].velocity)
  })

  it('guitar-strum-up → high-to-low, lighter velocity than down strum', () => {
    const t = getTechnique('guitar-strum-up')!
    const down = getTechnique('guitar-strum-down')!
    const notes = ['E2', 'A2', 'D3', 'G3']
    const upEvents = t.schedule(notes, stubCtx)
    const downEvents = down.schedule(notes, stubCtx)
    // First upstrum note is the original last (high) note
    expect(upEvents[0].note).toBe('G3')
    // Max velocity on up should be less than on down
    const upMax = Math.max(...upEvents.map(e => e.velocity))
    const downMax = Math.max(...downEvents.map(e => e.velocity))
    expect(upMax).toBeLessThan(downMax)
  })

  it('guitar-muted-stab → very short 32n duration', () => {
    const t = getTechnique('guitar-muted-stab')!
    const events = t.schedule(['C4', 'E4', 'G4'], stubCtx)
    expect(events.every(e => e.duration === '32n')).toBe(true)
  })

  it('piano-alberti → produces 4-event 1-5-3-5 pattern', () => {
    const t = getTechnique('piano-alberti')!
    const events = t.schedule(['C4', 'E4', 'G4'], stubCtx)
    expect(events.length).toBe(4)
    // Pattern: root, fifth, third, fifth
    expect(events[0].note).toBe('C4')
    expect(events[1].note).toBe('G4')
    expect(events[2].note).toBe('E4')
    expect(events[3].note).toBe('G4')
  })

  it('strings-tremolo → many 16n repeats across chord duration', () => {
    const t = getTechnique('strings-tremolo')!
    const events = t.schedule(['C4', 'E4', 'G4'], stubCtx)
    // At 90 BPM, 16th ≈ 0.167s. In 2s: ~12 repeats × 3 notes = 36 events min.
    expect(events.length).toBeGreaterThan(20)
  })

  it('wind-legato → single event on top note for chord duration', () => {
    const t = getTechnique('wind-legato')!
    const events = t.schedule(['C4', 'E4', 'G4'], stubCtx)
    expect(events.length).toBe(1)
    expect(events[0].note).toBe('G4')
    expect(events[0].duration).toBe(stubCtx.chordDurationSec)
  })

  it('techniquesForFamily("plucked") returns only guitar-family techniques', () => {
    const plucked = techniquesForFamily('plucked')
    expect(plucked.length).toBeGreaterThan(0)
    for (const t of plucked) {
      expect(t.family).toContain('plucked')
    }
  })

  it('MODE_DEFAULT_TECHNIQUE has entries for every mode', () => {
    const modes = ['heat', 'ice', 'smoke', 'gravel', 'glow']
    for (const m of modes) {
      expect(MODE_DEFAULT_TECHNIQUE[m]).toBeDefined()
      // default must reference a real registered technique
      expect(getTechnique(MODE_DEFAULT_TECHNIQUE[m])).toBeDefined()
    }
  })

  it('defaultTechniqueForMode("unknown") falls back to default id', () => {
    expect(defaultTechniqueForMode('unknown-mode')).toBe(DEFAULT_TECHNIQUE_ID)
  })
})
