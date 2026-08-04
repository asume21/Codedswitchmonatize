import { describe, expect, it, vi } from 'vitest'
import { createToneMock } from './__mocks__/toneMock'
import type { OrganismKitSample } from '../../instruments/OrganismKitCache'

vi.mock('tone', () => createToneMock())
vi.mock('../../instruments/OrganismKitCache', () => ({
  loadOrganismKits: vi.fn(),
}))

import { buildSampleKitDefinitionFromSamples } from '../SampledDrumKit'

const sample = (role: OrganismKitSample['role'], fileName: string): OrganismKitSample => ({
  role,
  fileName,
  relativePath: fileName,
  url: `/api/organism/kits/infinity-real-beat/samples/${encodeURIComponent(fileName)}`,
})

describe('buildSampleKitDefinitionFromSamples', () => {
  it('builds controlled pools for infinity-real-beat using preferred sample pools', () => {
    const definition = buildSampleKitDefinitionFromSamples('infinity-real-beat', [
      sample('perc', 'Clap - Crackle 1.wav'),
      sample('kick', 'Kick - Tight.wav'),
      sample('kick', 'Kick - Hard.wav'),
      sample('kick', 'Kick - Thumpster.wav'),
      sample('snare', 'Snare - Tight.wav'),
      sample('snare', 'Snare - OG.wav'),
      sample('snare', 'Snare - Snapper.wav'),
      sample('hat', 'Hat - Sizzle.wav'),
      sample('hat', 'Hat - Noise.wav'),
      sample('hat', 'Hat - Vinyl.wav'),
      sample('hat', 'Hat - Sweet.wav'),
      sample('perc', 'Perc - Analog 1.wav'),
      sample('perc', 'Perc - Retrostick.wav'),
    ])

    expect(definition).not.toBeNull()
    expect(definition?.kick).toHaveLength(3)
    expect(definition?.snare).toHaveLength(3)
    expect(definition?.hatClosed).toEqual(expect.arrayContaining([
      expect.stringContaining('Hat%20-%20Sizzle.wav'),
      expect.stringContaining('Hat%20-%20Noise.wav'),
    ]))
    expect(definition?.hatOpen).toEqual(expect.arrayContaining([
      expect.stringContaining('Hat%20-%20Vinyl.wav'),
      expect.stringContaining('Hat%20-%20Sweet.wav'),
    ]))
    expect(definition?.perc.every((url) => url.includes('Perc%20-'))).toBe(true)
  })

  it('falls back to role pools for unknown kits', () => {
    const definition = buildSampleKitDefinitionFromSamples('unknown-kit', [
      sample('kick', 'A Kick.wav'),
      sample('snare', 'A Snare.wav'),
      sample('hat', 'Closed Hat.wav'),
      sample('tom', 'Floor Tom.wav'),
    ])

    expect(definition).toMatchObject({
      kick: [expect.stringContaining('A%20Kick.wav')],
      snare: [expect.stringContaining('A%20Snare.wav')],
      hatClosed: [expect.stringContaining('Closed%20Hat.wav')],
      perc: [expect.stringContaining('Floor%20Tom.wav')],
    })
    expect(definition?.hatOpen).toEqual(definition?.hatClosed)
  })
})
