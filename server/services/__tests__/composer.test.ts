import { describe, expect, it } from 'vitest'
import { composeDeterministic } from '../composer'
import { validateArrangementPlan } from '../../../shared/arrangement'

describe('composeDeterministic', () => {
  it('produces a valid ArrangementPlan from an empty input', () => {
    const plan = composeDeterministic({})
    expect(validateArrangementPlan(plan)).toBeNull()
    expect(plan.sections.length).toBe(6)  // producer arrangement skeleton
    expect(plan.sections[0].name).toBe('intro')
    expect(plan.sections[3].name).toBe('drop')
    expect(plan.key).toBe('C')
    expect(plan.subGenre).toBe('boom-bap')
  })

  it('honours sub-genre + applies the matching BPM default', () => {
    const trap = composeDeterministic({ subGenre: 'trap' })
    expect(trap.subGenre).toBe('trap')
    expect(trap.bpm).toBe(140)
    expect(validateArrangementPlan(trap)).toBeNull()
    // Trap uses i-VI-VII-i; verify the progression carries through to every section
    for (const section of trap.sections) {
      expect(section.progression).toEqual(['i', 'VI', 'VII', 'i'])
    }
  })

  it('falls back to hip-hop progression for unknown sub-genres', () => {
    const weird = composeDeterministic({ subGenre: 'breakcore' })
    expect(weird.sections[0].progression).toEqual(['i', 'iv', 'V', 'i'])
  })

  it('user-supplied key + bpm override defaults', () => {
    const plan = composeDeterministic({ subGenre: 'lo-fi', key: 'F#', bpm: 72 })
    expect(plan.key).toBe('F#')
    expect(plan.bpm).toBe(72)
  })

  it('honours locked template and style pools', () => {
    const allowedStyleIds = ['lofi-warm', 'cloud-floaty']
    const plan = composeDeterministic({
      subGenre: 'chill',
      mood: 'cool',
      bpm: 85,
      allowedTemplateIds: ['lofi-loop'],
      allowedStyleIds,
    })

    expect(plan.templateId).toBe('lofi-loop')
    expect(plan.subGenre).toBe('chill')
    expect(validateArrangementPlan(plan)).toBeNull()
    for (const section of plan.sections) {
      expect(section.style).toBeDefined()
      expect(allowedStyleIds).toContain(section.style)
    }
  })

  it('every plan has a unique id and a non-empty acePrompt', () => {
    const a = composeDeterministic({})
    const b = composeDeterministic({})
    expect(a.id).not.toBe(b.id)
    expect(a.acePrompt.length).toBeGreaterThan(0)
    expect(b.acePrompt.length).toBeGreaterThan(0)
  })
})
