#!/usr/bin/env node
/**
 * Render a spectrogram PNG for any audio file — a PICTURE of the sound.
 *
 *   npm run spectro -- "audio/reference-beats/Weekend .mp3"
 *   npm run spectro -- marketing/output/fire-beats/listen/boombap-full-seed42.wav 20
 *
 * Second arg = seconds to render (default 12). PNGs land in
 * marketing/output/spectrograms/ so reference beats and Organism captures can be
 * compared side by side.
 *
 * Why this exists: Claude cannot accept audio, but CAN see images. A spectrogram
 * is a picture of sound, so this turns "describe the audio to me" (a lossy relay
 * through another model that has none of the project context) into direct
 * inspection. Reference-vs-ours comparison found, in one look: our low end has
 * holes where a reference 808 rings continuously, and the texture noise bed
 * smears broadband energy across the whole spectrum.
 *
 * Requires ffmpeg on PATH.
 */
import { spawnSync } from 'child_process'
import { mkdirSync, existsSync } from 'fs'
import { basename, extname, join } from 'path'

const input = process.argv[2]
const seconds = process.argv[3] ?? '12'

if (!input) {
  console.error('usage: npm run spectro -- <audio-file> [seconds]')
  process.exit(1)
}
if (!existsSync(input)) {
  console.error(`no such file: ${input}`)
  process.exit(1)
}

const outDir = join('marketing', 'output', 'spectrograms')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, `${basename(input, extname(input)).replace(/\s+/g, '_')}.png`)

// scale=log + intensity colour: harmonics read as horizontal lines, transients as
// vertical spikes, and broadband noise as a smear across the whole height.
const res = spawnSync('ffmpeg', [
  '-v', 'error',
  '-t', String(seconds),
  '-i', input,
  '-lavfi', 'showspectrumpic=s=1000x420:legend=1:color=intensity:scale=log',
  '-y', outFile,
], { stdio: 'inherit' })

if (res.status !== 0) {
  console.error('ffmpeg failed — is it installed and on PATH?')
  process.exit(res.status ?? 1)
}

console.log(`\n  ${outFile}\n`)
console.log('  How to read it:')
console.log('    x = time, y = frequency (low at the bottom), brightness = loudness')
console.log('    horizontal lines .... sustained pitched notes (bass, keys, pads)')
console.log('    vertical spikes ..... drum transients (kick/snare/hat)')
console.log('    broad smear ......... noise (a wash, a riser, or hiss)')
console.log('    black gaps .......... silence — holes in the mix\n')
