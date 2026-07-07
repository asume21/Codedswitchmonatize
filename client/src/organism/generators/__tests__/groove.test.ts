import { describe, expect, it } from 'vitest'
import { applyGroovePocket } from '../groove'

describe('groove pocket', () => {
  it('adds the pocket offset for the requested sixteenth slot', () => {
    const pocket = Array(16).fill(0)
    pocket[5] = 0.018

    expect(applyGroovePocket(1.25, 5, pocket)).toBeCloseTo(1.268)
  })

  it('wraps slots and treats missing offsets as zero', () => {
    const pocket = Array(16).fill(0)
    pocket[15] = 0.011

    expect(applyGroovePocket(0.5, -1, pocket)).toBeCloseTo(0.511)
    expect(applyGroovePocket(0.5, 32, [])).toBeCloseTo(0.5)
  })
})
