import { describe, it, expect } from 'vitest'
import { bassVelocityForJob } from '../score'

const base = { slot: 4, bar: 0, bars: 4, energy: 0.6 }

describe('bassVelocityForJob — every note has a reason', () => {
  it('is deterministic: same musical position gives the same weight', () => {
    // A locked section must repeat byte-identically, so this cannot be random.
    expect(bassVelocityForJob(base)).toBe(bassVelocityForJob(base))
  })

  it('accents the downbeat over an off-beat connector', () => {
    expect(bassVelocityForJob({ ...base, slot: 0 }))
      .toBeGreaterThan(bassVelocityForJob({ ...base, slot: 6 }))
  })

  it('leans in when the note lands WITH the kick', () => {
    const withKick = bassVelocityForJob({ ...base, kickSlots: [4] })
    const offKick  = bassVelocityForJob({ ...base, kickSlots: [8] })
    expect(withKick).toBeGreaterThan(offKick)
  })

  it('backs off when the lead is busy in that slot — makes room, no live ducking', () => {
    const clear = bassVelocityForJob({ ...base })
    const busy  = bassVelocityForJob({ ...base, leadBusy: [4] })
    expect(busy).toBeLessThan(clear)
  })

  it('plays softer in a low-energy section than in a high-energy one', () => {
    expect(bassVelocityForJob({ ...base, energy: 0.2 }))
      .toBeLessThan(bassVelocityForJob({ ...base, energy: 1.0 }))
  })

  it('lands the phrase — a resolution hits harder than the same note mid-phrase', () => {
    expect(bassVelocityForJob({ ...base, isResolution: true }))
      .toBeGreaterThan(bassVelocityForJob({ ...base, isResolution: false }))
  })

  it('pushes gently toward the end of the phrase', () => {
    expect(bassVelocityForJob({ ...base, bar: 3 }))
      .toBeGreaterThan(bassVelocityForJob({ ...base, bar: 0 }))
  })

  it('never goes silent and never clips, even at the extremes', () => {
    const quietest = bassVelocityForJob({ slot: 9, bar: 0, bars: 4, energy: 0, leadBusy: [9] })
    const loudest  = bassVelocityForJob({ slot: 0, bar: 3, bars: 4, energy: 1, kickSlots: [48], isResolution: true })
    expect(quietest).toBeGreaterThanOrEqual(0.25)
    expect(loudest).toBeLessThanOrEqual(1)
  })
})
