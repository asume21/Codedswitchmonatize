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
    // Each section now has its own progression — intro ≠ verse ≠ build ≠ drop
    const progressions = trap.sections.map(s => JSON.stringify(s.progression))
    const unique = new Set(progressions)
    expect(unique.size).toBeGreaterThan(1)
    // Drop is the hardest section — verify it has content
    const drop = trap.sections.find(s => s.name === 'drop')
    expect(drop?.progression.length).toBeGreaterThan(0)
  })

  it('falls back to a section-appropriate progression for unknown sub-genres', () => {
    const weird = composeDeterministic({ subGenre: 'breakcore' })
    // Generic fallback is still section-varied — intro ≠ drop
    const intro = weird.sections.find(s => s.name === 'intro')?.progression
    const drop  = weird.sections.find(s => s.name === 'drop')?.progression
    expect(intro?.length).toBeGreaterThan(0)
    expect(JSON.stringify(intro)).not.toBe(JSON.stringify(drop))
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

  it('every section has a full orchestration (lead/support/out per instrument)', () => {
    const plan = composeDeterministic({ subGenre: 'trap' })
    for (const s of plan.sections) {
      expect(s.orchestration).toBeDefined()
      for (const k of ['drums', 'bass', 'chord', 'melody', 'texture'] as const) {
        expect(['lead', 'support', 'out']).toContain(s.orchestration![k])
      }
    }
  })

  it('keeps a constant pocket — no section sits drums or bass out — and the drop pushes them forward', () => {
    const plan = composeDeterministic({})
    const drop = plan.sections.find(s => s.name === 'drop')
    // Freestyling needs a groove that never disappears: no section may set
    // drums or bass to 'out'. Build/drop comes from energy + leading, not
    // from cutting the rhythm section to silence.
    for (const s of plan.sections) {
      expect(s.orchestration?.drums).not.toBe('out')
      expect(s.orchestration?.bass).not.toBe('out')
    }
    expect(drop?.orchestration?.drums).toBe('lead')
    expect(drop?.orchestration?.bass).toBe('lead')
  })
})
