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
  it('uses deterministic foundation patterns for initial mode grooves', () => {
    const kit = getDrumKit(OrganismMode.Heat)
    const first = signature(buildDrumPattern(kit, OrganismMode.Heat).hits)
    const second = signature(buildDrumPattern(kit, OrganismMode.Heat).hits)

    expect(second).toEqual(first)
  })

  it('defaults sub-genre generation to the first variant instead of random selection', () => {
    const first = signature(buildSubGenrePattern('trap').hits)
    const second = signature(buildSubGenrePattern('trap').hits)

    expect(second).toEqual(first)
  })

  it('anchors foundation grooves with kick and snare responsibilities', () => {
    const hits = buildDrumPattern(getDrumKit(OrganismMode.Smoke), OrganismMode.Smoke).hits

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
