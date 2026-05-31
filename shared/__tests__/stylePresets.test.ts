import { describe, expect, it } from 'vitest'
import { STYLE_PRESETS, getStylePreset } from '../stylePresets'

describe('STYLE_PRESETS', () => {
  it('keeps curated styles playable when melody is soloed', () => {
    const silentMelodyStyles = STYLE_PRESETS
      .filter((preset) => preset.melodyArticulation === 'none')
      .map((preset) => preset.id)

    expect(silentMelodyStyles).toEqual([])
  })

  it('includes dedicated funk and story bundles', () => {
    const expected = [
      'funk-muted-pocket',
      'funk-bounce-keys',
      'funk-guitar-roll',
      'story-piano-roll',
      'story-strings-pad',
      'story-pizzicato',
    ]

    for (const id of expected) {
      expect(getStylePreset(id)).not.toBeNull()
    }
  })
})
