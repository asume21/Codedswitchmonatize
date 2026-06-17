import { describe, expect, it } from 'vitest'
import { roleCeiling } from '../arrangementRole'

describe('roleCeiling', () => {
  it('out silences the part', () => { expect(roleCeiling('out')).toBe(0) })
  it('support is a restrained ceiling', () => { expect(roleCeiling('support')).toBe(0.6) })
  it('lead is the full ceiling', () => { expect(roleCeiling('lead')).toBe(1.0) })
  it('unknown/undefined defaults to support (never throws)', () => {
    expect(roleCeiling(undefined)).toBe(0.6)
    expect(roleCeiling('bogus' as never)).toBe(0.6)
  })
})
