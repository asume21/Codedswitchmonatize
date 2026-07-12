import { afterEach, describe, expect, it } from 'vitest'
import type { ArrangementSection } from '@shared/arrangement'
import {
  slotFromPlanSection,
  setArrangementFromPlan,
  clearArrangementFromPlan,
  setActiveArrangementTemplate,
  getProducerArrangementSlot,
  getProducerArrangementTotalBars,
} from '../ProducerArrangement'

function section(over: Partial<ArrangementSection> = {}): ArrangementSection {
  return {
    name: 'verse',
    bars: 4,
    progression: ['i', 'iv', 'V', 'i'],
    energy: 0.5,
    density: 0.5,
    ...over,
  }
}

describe('slotFromPlanSection', () => {
  it('passes through section name and bar count', () => {
    const slot = slotFromPlanSection(section({ name: 'drop', bars: 8 }))
    expect(slot.name).toBe('drop')
    expect(slot.bars).toBe(8)
  })

  it('clamps bars into the engine-safe 1..64 range', () => {
    expect(slotFromPlanSection(section({ bars: 0 })).bars).toBe(1)
    expect(slotFromPlanSection(section({ bars: 999 })).bars).toBe(64)
    expect(slotFromPlanSection(section({ bars: 6.7 })).bars).toBe(7)
  })

  it('clamps energy into 0..1', () => {
    expect(slotFromPlanSection(section({ energy: -1 })).energy).toBe(0)
    expect(slotFromPlanSection(section({ energy: 5 })).energy).toBe(1)
  })

  it('drives drum level by density (denser → louder drums)', () => {
    const quiet = slotFromPlanSection(section({ density: 0.1 }))
    const busy = slotFromPlanSection(section({ density: 0.9 }))
    expect(busy.drums).toBeGreaterThan(quiet.drums)
  })

  it('lifts bass and melody with energy', () => {
    const low = slotFromPlanSection(section({ energy: 0.2 }))
    const high = slotFromPlanSection(section({ energy: 0.9 }))
    expect(high.bass).toBeGreaterThan(low.bass)
    expect(high.melody).toBeGreaterThan(low.melody)
  })

  it('recedes chords as energy rises so drums/bass dominate the drop', () => {
    const low = slotFromPlanSection(section({ energy: 0.2 }))
    const high = slotFromPlanSection(section({ energy: 0.9 }))
    expect(high.chord).toBeLessThan(low.chord)
  })

  it('keeps texture audible by default so generated pads reach the mix', () => {
    expect(slotFromPlanSection(section()).texture).toBeGreaterThan(0)
  })

  it('never hard-drops a channel — audition mode reads silence as failure', () => {
    const slot = slotFromPlanSection(section({ energy: 0, density: 0 }))
    expect(slot.drumDropout).toBe(false)
    expect(slot.bassDropout).toBe(false)
    expect(slot.melodyDropout).toBe(false)
    expect(slot.drums).toBeGreaterThan(0)
    expect(slot.bass).toBeGreaterThan(0)
    expect(slot.melody).toBeGreaterThan(0)
  })
})

describe('setArrangementFromPlan', () => {
  afterEach(() => {
    // Leave global module state clean for sibling suites.
    clearArrangementFromPlan()
    setActiveArrangementTemplate('classic')
  })

  it('makes plan sections the source of truth for durations', () => {
    setArrangementFromPlan([
      section({ name: 'intro', bars: 2 }),
      section({ name: 'verse', bars: 4 }),
      section({ name: 'drop', bars: 8 }),
    ])
    expect(getProducerArrangementTotalBars()).toBe(14)
    // Bar 0..1 → intro, 2..5 → verse, 6..13 → drop, then wraps.
    expect(getProducerArrangementSlot(0).slot.name).toBe('intro')
    expect(getProducerArrangementSlot(2).slot.name).toBe('verse')
    expect(getProducerArrangementSlot(6).slot.name).toBe('drop')
    expect(getProducerArrangementSlot(13).slot.name).toBe('drop')
    expect(getProducerArrangementSlot(14).slot.name).toBe('intro') // wrap
    expect(getProducerArrangementSlot(6).sectionBar).toBe(0)
    expect(getProducerArrangementSlot(7).sectionBar).toBe(1)
  })

  it('reverts to the active named template when cleared', () => {
    setActiveArrangementTemplate('classic')
    const templateBars = getProducerArrangementTotalBars()
    setArrangementFromPlan([section({ name: 'verse', bars: 13 })])
    expect(getProducerArrangementTotalBars()).toBe(13)
    clearArrangementFromPlan()
    expect(getProducerArrangementTotalBars()).toBe(templateBars)
  })

  it('ignores an empty section list (keeps the template active)', () => {
    setActiveArrangementTemplate('classic')
    const templateBars = getProducerArrangementTotalBars()
    setArrangementFromPlan([])
    expect(getProducerArrangementTotalBars()).toBe(templateBars)
  })
})
