import { describe, it, expect } from 'vitest'
import { buildTranscodeArgs } from '../lyricVideoTranscode'

describe('buildTranscodeArgs', () => {
  const args = buildTranscodeArgs()

  it('encodes H.264 video + AAC audio (MP4 baseline)', () => {
    expect(args).toContain('-c:v libx264')
    expect(args).toContain('-c:a aac')
  })

  it('includes the flags that make the mp4 play outside Chrome', () => {
    // Without these, the file plays in Chrome but fails on iOS/Instagram/TikTok.
    expect(args).toContain('-pix_fmt yuv420p')
    expect(args).toContain('-movflags +faststart')
  })
})
