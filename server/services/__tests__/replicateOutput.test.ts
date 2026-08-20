import { describe, it, expect } from 'vitest'
import { toReplicateUrl, extractReplicateAudioUrl } from '../replicateOutput'

/**
 * Reproduces the shape the Replicate JS client (>=1.x, useFileOutput defaults
 * to true) actually hands back: a ReadableStream subclass whose toString() is
 * the URL. It has no toJSON and no own enumerable properties, so JSON.stringify
 * turns it into "{}" — which is exactly what shipped to the client as
 * "audioUrl": {} and left generated packs with nothing to play.
 */
function makeFileOutput(url: string) {
  class FileOutput extends ReadableStream {
    url() { return new URL(url) }
    toString() { return url }
  }
  return new FileOutput({ start(c) { c.close() } })
}

const URL_A = 'https://replicate.delivery/pbxt/abc/variation_01.wav'

describe('FileOutput is the shape that broke sample packs', () => {
  it('serialises to an empty object, proving a raw cast cannot survive res.json()', () => {
    expect(JSON.stringify(makeFileOutput(URL_A))).toBe('{}')
  })
})

describe('toReplicateUrl', () => {
  it('unwraps a FileOutput to its URL', () => {
    expect(toReplicateUrl(makeFileOutput(URL_A))).toBe(URL_A)
  })

  it('passes plain URL strings through', () => {
    expect(toReplicateUrl(URL_A)).toBe(URL_A)
  })

  it('accepts data: URIs', () => {
    expect(toReplicateUrl('data:audio/wav;base64,AAAA')).toBe('data:audio/wav;base64,AAAA')
  })

  it('returns undefined for the null holes the looper leaves in its 20 variation keys', () => {
    expect(toReplicateUrl(null)).toBeUndefined()
    expect(toReplicateUrl(undefined)).toBeUndefined()
  })

  it('returns undefined rather than "[object Object]" for a plain object', () => {
    expect(toReplicateUrl({ nope: 1 })).toBeUndefined()
  })

  it('rejects non-URL strings so a stray label never becomes an audio src', () => {
    expect(toReplicateUrl('variation_01')).toBeUndefined()
  })
})

describe('extractReplicateAudioUrl', () => {
  it('finds a FileOutput at the top level', () => {
    expect(extractReplicateAudioUrl(makeFileOutput(URL_A))).toBe(URL_A)
  })

  it('finds a FileOutput inside an array', () => {
    expect(extractReplicateAudioUrl([makeFileOutput(URL_A)])).toBe(URL_A)
  })

  it('finds a FileOutput under a known audio key', () => {
    expect(extractReplicateAudioUrl({ audio: makeFileOutput(URL_A) })).toBe(URL_A)
  })

  it('still handles the plain-string REST shape', () => {
    expect(extractReplicateAudioUrl({ audio_out: URL_A })).toBe(URL_A)
  })

  it('returns undefined when there is no audio anywhere', () => {
    expect(extractReplicateAudioUrl({ status: 'ok' })).toBeUndefined()
  })
})
