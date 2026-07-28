import { describe, it, expect, beforeEach } from 'vitest'
import { setSongCellStyle } from '../songCell'
import { getSessionSalt, setFreeplaySeed } from '../utils'

describe('setSongCellStyle variety', () => {
  beforeEach(() => {
    setFreeplaySeed(null)      // unpin so re-roll is allowed
    setSongCellStyle(null)     // reset authoritative style
  })

  it('re-rolls the session salt when the style actually changes', () => {
    setSongCellStyle('lofi')
    const saltA = getSessionSalt()
    setSongCellStyle('trap')
    const saltB = getSessionSalt()
    expect(saltB).not.toBe(saltA)   // a real change re-rolls
  })

  it('does NOT re-roll when the style is unchanged', () => {
    setSongCellStyle('lofi')
    const salt1 = getSessionSalt()
    setSongCellStyle('lofi')        // same style → early-return, no re-roll
    expect(getSessionSalt()).toBe(salt1)
  })

  it('does NOT re-roll when a seed is pinned (Lock stays reproducible)', () => {
    setFreeplaySeed(12345)          // pin
    const pinned = getSessionSalt()
    setSongCellStyle('lofi')
    setSongCellStyle('trap')
    expect(getSessionSalt()).toBe(pinned)
  })
})
