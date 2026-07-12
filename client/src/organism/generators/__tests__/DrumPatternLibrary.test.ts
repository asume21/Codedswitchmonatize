import { describe, expect, it } from 'vitest'
import { OrganismMode } from '../../physics/types'
import { DrumInstrument } from '../types'
import {
  buildDrumPattern,
  buildSubGenrePattern,
  getDrumKit,
} from '../patterns/DrumPatternLibrary'

const signature = (hits: ReturnType<typeof buildDrumPattern>['hits']) =>
  hits.map(hit => `${hit.instrument}@${hit.time}`)

describe('DrumPatternLibrary', () => {
  it('uses deterministic foundation patterns when a variant is requested', () => {
    const kit = getDrumKit(OrganismMode.Heat)
    const first = signature(buildDrumPattern(kit, OrganismMode.Heat, 0).hits)
    const second = signature(buildDrumPattern(kit, OrganismMode.Heat, 0).hits)

    expect(second).toEqual(first)
  })

  it('uses deterministic sub-genre patterns when a variant is requested', () => {
    const first = signature(buildSubGenrePattern('trap', 0).hits)
    const second = signature(buildSubGenrePattern('trap', 0).hits)

    expect(second).toEqual(first)
  })

  it('adds deterministic micro-timing so generated hits do not feel grid-locked', () => {
    const hits = buildSubGenrePattern('trap', 0).hits
    const repeated = buildSubGenrePattern('trap', 0).hits

    expect(hits.some(hit => hit.microShift != null && Math.abs(hit.microShift) > 0)).toBe(true)
    expect(hits.map(hit => hit.microShift)).toEqual(repeated.map(hit => hit.microShift))
  })

  it('anchors foundation grooves with kick and snare responsibilities', () => {
    const hits = buildDrumPattern(getDrumKit(OrganismMode.Smoke), OrganismMode.Smoke, 0).hits

    expect(hits).toContainEqual(expect.objectContaining({
      instrument: DrumInstrument.Kick,
      time: '0:0:0.00',
    }))
    expect(hits).toContainEqual(expect.objectContaining({
      instrument: DrumInstrument.Snare,
      time: '0:1:0.00',
    }))
    expect(hits).toContainEqual(expect.objectContaining({
      instrument: DrumInstrument.Snare,
      time: '0:3:0.00',
    }))
  })
})
