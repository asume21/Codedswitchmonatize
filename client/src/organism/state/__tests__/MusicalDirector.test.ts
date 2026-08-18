import { beforeEach, describe, expect, it } from 'vitest'
import { MusicalDirector } from '../MusicalDirector'
import { setActiveArrangementTemplate } from '../ProducerArrangement'
import { OrganismMode } from '../../physics/types'
import type { PhysicsState } from '../../physics/types'
import { OState } from '../types'
import type { OrganismState } from '../types'

function makePhysics(overrides: Partial<PhysicsState> = {}): PhysicsState {
  return {
    bounce: 0.5,
    swing: 0.5,
    pocket: 0.5,
    presence: 0.5,
    density: 0.45,
    mode: OrganismMode.Glow,
    pulse: 90,
    beatDurationMs: 667,
    sixteenthDurationMs: 167,
    swungSixteenthMs: 184,
    timestamp: 1000,
    frameIndex: 1,
    voiceActive: false,
    ...overrides,
  }
}

function makeOrganism(overrides: Partial<OrganismState> = {}): OrganismState {
  return {
    current: OState.Breathing,
    previous: OState.Awakening,
    framesInState: 120,
    msInState: 2800,
    barsInState: 2,
    awakeningProgress: 1,
    breathingWarmth: 0.7,
    flowDepth: 0,
    syllabicDensity: 1,
    cadenceLockBars: 0,
    cadenceLockAchieved: false,
    silenceDurationMs: 0,
    lastTransitionPhysics: null,
    timestamp: 1000,
    frameIndex: 1,
    ...overrides,
  }
}

describe('MusicalDirector arrangement masks', () => {
  beforeEach(() => {
    setActiveArrangementTemplate('classic')
  })

  it('starts with a sparse audible intro, then adds verse and drop layers by section', () => {
    const director = new MusicalDirector()
    director.setArrangementEnabled(true)
    const physics = makePhysics()
    const organism = makeOrganism()

    director.update(physics, organism, 0)
    expect(director.getState().section).toBe('intro')
    expect(director.getState().drums.dropout).toBe(false)
    expect(director.getState().bass.dropout).toBe(false)
    expect(director.getState().melody.dropout).toBe(false)

    director.update(physics, organism, 10)
    expect(director.getState().section).toBe('verse')
    expect(director.getState().drums.dropout).toBe(false)
    expect(director.getState().bass.dropout).toBe(false)
    expect(director.getState().melody.dropout).toBe(false)

    director.update(physics, makeOrganism({ current: OState.Flow, flowDepth: 1 }), 36)
    expect(director.getState().section).toBe('drop')
    expect(director.getState().drums.dropout).toBe(false)
    expect(director.getState().bass.dropout).toBe(false)
    expect(director.getState().melody.dropout).toBe(false)
  })

  it('keeps jam mode sectionless and does not emit hidden section changes', () => {
    const director = new MusicalDirector()
    const physics = makePhysics()
    const organism = makeOrganism()
    const sections: string[] = []

    director.onSectionChange((section) => sections.push(section))

    director.update(physics, organism, 0)
    director.update(physics, organism, 4)
    director.update(physics, makeOrganism({ current: OState.Flow, flowDepth: 1 }), 8)

    expect(director.getState().section).toBe('none')
    expect(director.getState().sectionBar).toBe(0)
    expect(director.getState().arrangementTotalBars).toBe(0)
    expect(director.getState().drums.dropout).toBe(false)
    expect(director.getState().bass.dropout).toBe(false)
    expect(director.getState().melody.dropout).toBe(false)
    expect(director.getState().drums.fillRequested).toBe(false)
    expect(sections).toEqual([])
  })
})

// ── Repeated section names ───────────────────────────────────────────
// Detecting a section change by NAME merges adjacent same-name slots into one
// long block: cypher-flow (verse/verse/verse) never changed section at all,
// so the locked loop played unbroken for the whole form and the wrap was
// silent. The slot INDEX is what actually identifies a section.
describe('MusicalDirector section identity', () => {
  beforeEach(() => {
    setActiveArrangementTemplate('cypher-flow')
  })

  it('fires a change for each same-named slot, and again on the wrap', () => {
    const director = new MusicalDirector()
    director.setArrangementEnabled(true)
    const physics = makePhysics()
    const organism = makeOrganism()

    const fired: Array<{ section: string; cycle: number }> = []
    director.onSectionChange((section, _slot, ctx) => {
      fired.push({ section, cycle: ctx?.cycle ?? -1 })
    })

    // cypher-flow is three 4-bar verses, scaled x4 => 16 live bars each, 48 total.
    for (const bar of [0, 8, 16, 24, 32, 40, 48, 56]) {
      director.update(physics, organism, bar)
    }

    // Bars 0/16/32 are the three slots of pass 0; bar 48 wraps to slot 0 of
    // pass 1. Bar 56 is still inside that slot, so it correctly does not fire.
    expect(fired.map(f => f.section)).toEqual(['verse', 'verse', 'verse', 'verse'])
    expect(fired.map(f => f.cycle)).toEqual([0, 0, 0, 1])
  })
})
