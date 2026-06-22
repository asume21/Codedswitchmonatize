import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AceHybridController, type StemLayerLike } from '../AceHybridController'
import type { AceStem } from '@/organism/loops/AceStemLayer'

function makeFakeLayer() {
  const calls = { active: [] as boolean[], played: 0, stopped: 0, loaded: [] as AceStem[][] }
  const layer: StemLayerLike = {
    load: vi.fn(async (stems: AceStem[]) => { calls.loaded.push(stems) }),
    play: vi.fn(() => { calls.played++ }),
    stop: vi.fn(() => { calls.stopped++ }),
    setActive: vi.fn((a: boolean) => { calls.active.push(a) }),
  }
  return { layer, calls }
}

const STEMS: AceStem[] = [{ name: 'drums', url: '/d.wav', bpm: 140 }, { name: 'bass', url: '/b.wav', bpm: 140 }]

// Let the in-flight ensureStems() promise settle.
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('AceHybridController — live/ace/both mode switch', () => {
  let band: ReturnType<typeof vi.fn>

  beforeEach(() => { band = vi.fn() })

  it('defaults to live: band not silenced, stems inactive, no render', () => {
    const { layer } = makeFakeLayer()
    const fetchStems = vi.fn()
    const c = new AceHybridController({ stemLayer: layer, setBandSilenced: (silenced) => band(silenced), fetchStems })
    expect(c.getMode()).toBe('live')
    expect(fetchStems).not.toHaveBeenCalled()
    expect(band).not.toHaveBeenCalledWith(true)
  })

  it('ace mode renders, then silences the band and activates stems on arrival', async () => {
    const { layer, calls } = makeFakeLayer()
    const fetchStems = vi.fn(async () => STEMS)
    const c = new AceHybridController({ stemLayer: layer, setBandSilenced: (silenced) => band(silenced), fetchStems })

    c.setRequest({ prompt: 'trap', bpm: 140 })
    c.setMode('ace')
    await flush()

    expect(fetchStems).toHaveBeenCalledTimes(1)
    expect(calls.loaded[0]).toEqual(STEMS)
    expect(calls.played).toBeGreaterThan(0)
    expect(c.isStemsReady()).toBe(true)
    expect(layer.setActive).toHaveBeenLastCalledWith(true)
    expect(band).toHaveBeenLastCalledWith(true) // band silenced once stems are live
  })

  it('does NOT silence the band while stems are still rendering (graceful handoff)', async () => {
    const { layer } = makeFakeLayer()
    let resolveFetch: (s: AceStem[]) => void
    const fetchStems = vi.fn(() => new Promise<AceStem[]>((res) => { resolveFetch = res }))
    const c = new AceHybridController({ stemLayer: layer, setBandSilenced: (silenced) => band(silenced), fetchStems })

    c.setRequest({ prompt: 'trap', bpm: 140 })
    c.setMode('ace')
    await flush()
    // stems not resolved yet → band must still be playing
    expect(band).not.toHaveBeenCalledWith(true)
    expect(c.isStemsReady()).toBe(false)

    resolveFetch!(STEMS)
    await flush()
    expect(band).toHaveBeenLastCalledWith(true)
  })

  it('both mode: stems active AND band NOT silenced', async () => {
    const { layer } = makeFakeLayer()
    const fetchStems = vi.fn(async () => STEMS)
    const c = new AceHybridController({ stemLayer: layer, setBandSilenced: (silenced) => band(silenced), fetchStems })

    c.setRequest({ prompt: 'trap', bpm: 140 })
    c.setMode('both')
    await flush()

    expect(layer.setActive).toHaveBeenLastCalledWith(true)
    expect(band).toHaveBeenLastCalledWith(false)
  })

  it('switching back to live deactivates stems and restores the band', async () => {
    const { layer } = makeFakeLayer()
    const fetchStems = vi.fn(async () => STEMS)
    const c = new AceHybridController({ stemLayer: layer, setBandSilenced: (silenced) => band(silenced), fetchStems })

    c.setRequest({ prompt: 'trap', bpm: 140 })
    c.setMode('ace')
    await flush()
    c.setMode('live')

    expect(layer.setActive).toHaveBeenLastCalledWith(false)
    expect(band).toHaveBeenLastCalledWith(false)
  })

  it('does not double-fetch when already requesting', async () => {
    const { layer } = makeFakeLayer()
    const fetchStems = vi.fn(async () => STEMS)
    const c = new AceHybridController({ stemLayer: layer, setBandSilenced: (silenced) => band(silenced), fetchStems })

    c.setRequest({ prompt: 'trap', bpm: 140 })
    c.setMode('ace')
    c.setMode('both') // second stem-using mode while first fetch in flight
    await flush()

    expect(fetchStems).toHaveBeenCalledTimes(1)
  })
})
