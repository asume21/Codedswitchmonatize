import { describe, it, expect } from 'vitest'
import {
  isEnergyLiftIntoDrop,
  planDropEntryBoost,
  planPreDropMoment,
  type ArrangementMomentSection,
} from '../ArrangementMoments'

function section(overrides: Partial<ArrangementMomentSection> = {}): ArrangementMomentSection {
  return {
    name: 'verse',
    bars: 4,
    energy: 0.6,
    drums: 0.85,
    bass: 0.95,
    melody: 0.85,
    chord: 0.75,
    texture: 0,
    ...overrides,
  }
}

describe('ArrangementMoments', () => {
  it('detects a real energy lift into a drop', () => {
    expect(isEnergyLiftIntoDrop(section({ name: 'build', energy: 0.78 }), section({ name: 'drop', energy: 1 }))).toBe(true)
    expect(isEnergyLiftIntoDrop(section({ name: 'verse', energy: 0.88 }), section({ name: 'drop', energy: 0.9 }))).toBe(false)
    expect(isEnergyLiftIntoDrop(section({ name: 'build', energy: 0.78 }), section({ name: 'verse', energy: 1 }))).toBe(false)
  })

  it('plans a bass-only pre-drop moment for ordinary lift sections', () => {
    const plan = planPreDropMoment({
      current: section({ name: 'verse', bars: 4, energy: 0.62 }),
      next: section({ name: 'drop', bars: 4, energy: 1 }),
      sectionBar: 3,
      barNumber: 11,
      cycleBar: 11,
      arrangementEnabled: true,
      melodyOnlyMode: false,
      drumEnabled: true,
    })

    expect(plan.shouldFire).toBe(true)
    expect(plan.breakStartTime).toBe('11:2:0')
    expect(plan.breakEndTime).toBe('12:0:0')
    expect(plan.bassDuck).toBe(0)
    expect(plan.melodyDuck).toBe(0.85)
    expect(plan.chordDuck).toBe(0.75)
    expect(plan.negativeSpace).toBe('bass-only')
  })

  it('uses stronger negative space for build-like sections entering a drop', () => {
    const plan = planPreDropMoment({
      current: section({ name: 'build', bars: 2, energy: 0.8, melody: 1, chord: 0.8 }),
      next: section({ name: 'drop', bars: 4, energy: 1 }),
      sectionBar: 1,
      barNumber: 23,
      cycleBar: 23,
      arrangementEnabled: true,
      melodyOnlyMode: false,
      drumEnabled: true,
    })

    expect(plan.shouldFire).toBe(true)
    expect(plan.negativeSpace).toBe('rhythm-section')
    expect(plan.melodyDuck).toBeLessThan(1)
    expect(plan.chordDuck).toBeLessThan(0.8)
  })

  it('does not schedule moments when arrangement is off or not at the final bar', () => {
    const current = section({ name: 'build', bars: 4, energy: 0.8 })
    const next = section({ name: 'drop', energy: 1 })

    expect(planPreDropMoment({
      current,
      next,
      sectionBar: 3,
      barNumber: 7,
      cycleBar: 7,
      arrangementEnabled: false,
      melodyOnlyMode: false,
      drumEnabled: true,
    }).shouldFire).toBe(false)

    expect(planPreDropMoment({
      current,
      next,
      sectionBar: 2,
      barNumber: 6,
      cycleBar: 6,
      arrangementEnabled: true,
      melodyOnlyMode: false,
      drumEnabled: true,
    }).shouldFire).toBe(false)
  })

  it('plans a one-bar drop-entry boost only on the drop downbeat', () => {
    const drop = section({ name: 'drop', energy: 1 })

    const entry = planDropEntryBoost(drop, 0)
    expect(entry.shouldBoost).toBe(true)
    expect(entry.kickMultiplier).toBeGreaterThan(1)
    expect(entry.hatMultiplier).toBeGreaterThan(1)
    expect(entry.settleBars).toBe(1)
    expect(entry.impactVelocity).toBe(1)

    expect(planDropEntryBoost(drop, 1).shouldBoost).toBe(false)
    expect(planDropEntryBoost(section({ name: 'verse' }), 0).shouldBoost).toBe(false)
  })
})
