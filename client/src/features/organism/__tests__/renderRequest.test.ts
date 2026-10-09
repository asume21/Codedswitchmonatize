import { describe, it, expect } from 'vitest'
import type { ArrangementPlan } from '@shared/arrangement'
import { buildRenderRequest, DEFAULT_RENDER_SECONDS, type LiveScore } from '../renderRequest'

const jam = (over: Partial<LiveScore> = {}): LiveScore => ({
  plan: null,
  subGenre: 'west-coast',
  bpm: 96,
  key: 'F',
  scale: 'minor',
  mood: null,
  performers: { lead: 'violin', chord: 'rhodes', bass: 'bass-synth' },
  ...over,
})

const plan = (over: Partial<ArrangementPlan> = {}): ArrangementPlan => ({
  id: 'p', key: 'F', bpm: 96, subGenre: 'west-coast', mood: 'melancholic',
  acePrompt: 'west coast hip-hop, warm pads, 90 bpm, sub bass',
  sections: [
    { name: 'intro', bars: 8, progression: ['i'], energy: 0.3, density: 0.3 },
    { name: 'verse', bars: 16, progression: ['i', 'VI'], energy: 0.6, density: 0.5 },
  ],
  ...over,
})

describe('buildRenderRequest — Render reads the live score', () => {
  it('uses the band tempo, key, scale and players — not 120, not a genre preset', () => {
    const r = buildRenderRequest(jam())
    expect(r.bpm).toBe(96)
    expect(r.prompt).toContain('96 bpm')
    expect(r.prompt).not.toContain('120 bpm')
    expect(r.prompt).toContain('west-coast')
    expect(r.prompt).toContain('f minor')
    expect(r.prompt).toContain('violin')
    expect(r.prompt).toContain('rhodes')
    expect(r.prompt).toContain('synth bass')
    expect(r.prompt).not.toMatch(/jazz/)
    expect(r.durationSec).toBe(DEFAULT_RENDER_SECONDS)
  })

  it('leaves mood out rather than inventing one', () => {
    expect(buildRenderRequest(jam()).prompt).not.toMatch(/\bdark\b/)
    expect(buildRenderRequest(jam({ mood: 'Dark' })).prompt).toContain('dark')
  })

  it('omits seats the router has not filled', () => {
    const r = buildRenderRequest(jam({ performers: { lead: null } }))
    expect(r.prompt).not.toContain('null')
    expect(r.prompt).not.toContain('violin')
  })

  it('reads the loaded plan: its tags, with the LIVE tempo replacing the plan bpm', () => {
    const r = buildRenderRequest(jam({ plan: plan(), mood: 'melancholic' }))
    expect(r.prompt).toContain('warm pads')
    expect(r.prompt).toContain('sub bass')
    expect(r.prompt).toContain('96 bpm')
    expect(r.prompt).not.toContain('90 bpm')
  })

  it('sizes the render to the plan: 24 bars at 96 bpm = 60s', () => {
    expect(buildRenderRequest(jam({ plan: plan() })).durationSec).toBe(60)
  })

  it('clamps plan duration to the model range', () => {
    const long = plan({ sections: Array.from({ length: 20 }, () => (
      { name: 'verse' as const, bars: 32, progression: ['i'], energy: 0.5, density: 0.5 })) })
    expect(buildRenderRequest(jam({ plan: long })).durationSec).toBe(240)
    const short = plan({ sections: [{ name: 'intro', bars: 2, progression: ['i'], energy: 0.3, density: 0.3 }] })
    expect(buildRenderRequest(jam({ plan: short })).durationSec).toBe(30)
  })

  it('bounds hostile LLM plan tags (count, length, markup)', () => {
    const hostile = plan({
      acePrompt: `<script>alert(1)</script>, ${'x'.repeat(5000)}, ` +
        Array.from({ length: 50 }, (_, i) => `tag${i}`).join(', '),
    })
    const r = buildRenderRequest(jam({ plan: hostile }))
    expect(r.prompt).not.toMatch(/[<>()]/)
    expect(r.prompt.split(', ').every(t => t.length <= 40)).toBe(true)
    expect(r.prompt).not.toContain('tag20')
    expect(r.prompt.length).toBeLessThan(1000)
  })
})
