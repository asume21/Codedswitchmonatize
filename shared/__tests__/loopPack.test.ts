import { describe, it, expect } from 'vitest'
import type { LoopPack, LoopClip } from '../loopPack'

describe('LoopPack types', () => {
  it('LoopClip has required fields', () => {
    const clip: LoopClip = { id: 'drums-1', url: 'https://example.com/drums.wav', bars: 4 }
    expect(clip.id).toBe('drums-1')
    expect(clip.bars).toBe(4)
  })

  it('LoopPack organises clips by instrument', () => {
    const pack: LoopPack = {
      id: 'hip-hop-classic', genre: 'hip-hop', bpm: 90, key: 'C', label: 'Hip-Hop Classic',
      loops: {
        drums:   [{ id: 'd1', url: '/d1.wav', bars: 4 }],
        bass:    [{ id: 'b1', url: '/b1.wav', bars: 4 }],
        melody:  [{ id: 'm1', url: '/m1.wav', bars: 4 }],
        chords:  [{ id: 'c1', url: '/c1.wav', bars: 4 }],
        texture: [{ id: 't1', url: '/t1.wav', bars: 4 }],
      },
    }
    expect(pack.loops.drums).toHaveLength(1)
    expect(pack.bpm).toBe(90)
  })
})
