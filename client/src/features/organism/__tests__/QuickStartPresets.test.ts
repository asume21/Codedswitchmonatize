import { describe, it, expect } from 'vitest'
import { QUICK_START_PRESETS, getQuickStartPreset } from '../QuickStartPresets'
import { OrganismMode } from '../../../organism/physics/types'

describe('QuickStartPresets — Real Beat presets', () => {
  it('includes the Real Beat presets', () => {
    const ids = QUICK_START_PRESETS.map(p => p.id)
    expect(ids).toContain('real-beat-trap-140')
    expect(ids).toContain('real-beat-boombap-90')
    expect(ids).toContain('real-beat-drill-144')
  })

  it('Real Beat: Trap is tuned for modern trap', () => {
    const preset = getQuickStartPreset('real-beat-trap-140')
    expect(preset).toBeDefined()
    expect(preset?.bpm).toBe(140)
    expect(preset?.mode).toBe(OrganismMode.Heat)
    expect(preset?.subGenre).toBe('trap')
    expect(preset?.energy).toBe('high')
    expect(preset?.allowedTemplateIds).toContain('trap-tag')
    expect(preset?.allowedStyleIds).toContain('trap-aggressive')
    expect(preset?.physics.bounce).toBeGreaterThan(0.6)
    expect(preset?.physics.pocket).toBeLessThan(0.4)
  })

  it('Real Beat: Boom-bap is tuned for classic boom-bap', () => {
    const preset = getQuickStartPreset('real-beat-boombap-90')
    expect(preset).toBeDefined()
    expect(preset?.bpm).toBe(90)
    expect(preset?.mode).toBe(OrganismMode.Smoke)
    expect(preset?.subGenre).toBe('boom-bap')
    expect(preset?.energy).toBe('medium')
    expect(preset?.allowedTemplateIds).toContain('storytelling')
    expect(preset?.allowedStyleIds).toContain('boombap-classic')
    expect(preset?.physics.swing).toBeGreaterThan(0.45)
  })

  it('Real Beat: Drill is tuned for dark drill', () => {
    const preset = getQuickStartPreset('real-beat-drill-144')
    expect(preset).toBeDefined()
    expect(preset?.bpm).toBe(144)
    expect(preset?.mode).toBe(OrganismMode.Gravel)
    expect(preset?.subGenre).toBe('drill')
    expect(preset?.energy).toBe('high')
    expect(preset?.allowedTemplateIds).toContain('trap-tag')
    expect(preset?.allowedStyleIds).toContain('drill-slide-hook')
  })

  it('every Real Beat preset has a sub-genre and mode', () => {
    const realBeatIds = ['real-beat-trap-140', 'real-beat-boombap-90', 'real-beat-drill-144']
    for (const id of realBeatIds) {
      const preset = getQuickStartPreset(id)
      expect(preset?.subGenre, `${id} subGenre`).toBeDefined()
      expect(preset?.mode, `${id} mode`).toBeDefined()
      expect(preset?.physics.pulse, `${id} pulse`).toBe(preset?.bpm)
    }
  })
})
