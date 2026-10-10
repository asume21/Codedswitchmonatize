import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateTempo, estimateKey } from './musicalFeatures.js'
import { loadAudio, AudioSourceError } from '../audioSource.js'
import { tmpdir } from 'node:os'

const SR = 44100
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** Drums: a decaying low "kick" on every beat (+ noise "hat" on 8ths) at `bpm`,
 *  over sustained notes (MIDI numbers), for `secs`. Deterministic noise. */
function beat(bpm: number, notes: number[], secs = 20, hatsOnly = false): Float32Array {
  const x = new Float32Array(SR * secs)
  let seed = 1
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1
  const beatS = 60 / bpm
  for (let t = 0; t < secs; t += beatS / 2) {
    const i0 = Math.round(t * SR)
    const onBeat = Math.round(t / beatS * 2) % 2 === 0
    for (let i = 0; i < SR * 0.12 && i0 + i < x.length; i++) {
      const env = Math.exp(-i / (SR * 0.02))
      if (onBeat && !hatsOnly) x[i0 + i] += 0.6 * env * Math.sin(2 * Math.PI * 55 * i / SR)
      x[i0 + i] += 0.15 * Math.exp(-i / (SR * 0.004)) * rnd()
    }
  }
  for (let i = 0; i < x.length; i++) for (const m of notes) x[i] += 0.08 * Math.sin(2 * Math.PI * midiHz(m) * i / SR)
  return x
}

/** Chord progression, each chord `secs` long, no drums. */
function progression(chords: number[][], secs = 4): Float32Array {
  const x = new Float32Array(SR * secs * chords.length)
  chords.forEach((c, ci) => {
    for (let i = 0; i < SR * secs; i++) for (const m of c) x[ci * SR * secs + i] += 0.1 * Math.sin(2 * Math.PI * midiHz(m) * i / SR)
  })
  return x
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

test('tempo: 96 bpm groove reads 96, not 48 or 192', () => {
  const c = estimateTempo(beat(96, [41, 53, 56, 60]))
  assert.ok(c.length > 0)
  assert.ok(near(c[0].bpm, 96, 1.5), `got ${JSON.stringify(c)}`)
})

test('tempo: 140 bpm hats read 140, not 70', () => {
  const c = estimateTempo(beat(140, [], 20, true))
  assert.ok(near(c[0].bpm, 140, 2), `got ${JSON.stringify(c)}`)
})

test('tempo: too short to judge returns no candidates', () => {
  assert.deepEqual(estimateTempo(beat(96, [], 2)), [])
})

test('key: sustained F minor (F2 F3 Ab3 C4) over drums reads F minor', () => {
  const k = estimateKey(beat(96, [41, 53, 56, 60]))
  assert.equal(k?.name, 'F minor', JSON.stringify(k))
})

test('key: I–IV–V–I in C reads C major', () => {
  const k = estimateKey(progression([[48, 60, 64, 67], [53, 60, 65, 69], [55, 59, 62, 67], [48, 60, 64, 67]]))
  assert.equal(k?.name, 'C major', JSON.stringify(k))
})

test('key: silence returns null', () => {
  assert.equal(estimateKey(new Float32Array(SR * 5)), null)
})

test('file input: hostile or invalid paths are refused before anything is read', async () => {
  const bad: Array<[Parameters<typeof loadAudio>[0], RegExp]> = [
    [{ file: 'relative/beat.wav' }, /absolute/],
    [{ file: '-i' }, /absolute/],
    [{ file: 'http://example.com/x.wav' }, /absolute/],
    [{ file: `${tmpdir()}/x.exe` }, /Unsupported/],
    [{ file: `${tmpdir()}/definitely-missing-${Date.now()}.wav` }, /not found/],
    [{ file: `${tmpdir()}.wav` }, /not found|Not a file/],
    [{}, /exactly one/],
    [{ file: `${tmpdir()}/a.wav`, capture_id: 'x' }, /exactly one/],
  ]
  for (const [args, re] of bad) {
    await assert.rejects(loadAudio(args), (e: unknown) => e instanceof AudioSourceError && re.test(e.message), JSON.stringify(args))
  }
})
