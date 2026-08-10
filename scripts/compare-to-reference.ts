/**
 * Compare the Organism's output to the reference beats — the ruler that was missing.
 *
 * The problem this solves: every musical value in the engine (kick/snare skeletons,
 * velocity curves, swing, EQ) was authored by something that cannot hear, and
 * validated with unit tests. Tests passing has never once meant the beat improved.
 * The user's verdict after many rounds: "none of it is even close."
 *
 * A real hip-hop beat is a MEASURABLE object though. This decodes the reference
 * beats in audio/reference-beats (the user: "all of them I think are fire") and our
 * own capture through the SAME analyzer — the existing pcmAnalyzer, not a new one —
 * and prints the gap. "Not close" becomes a list of numbers with a direction.
 *
 * Usage:
 *   npx tsx scripts/compare-to-reference.ts [ourWav]
 *   (default ourWav: the newest trap-full-*.wav under marketing/output/fire-beats)
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { analyzePcm, type PcmAnalysisReport } from '../client/src/organism/audio/pcmAnalyzer'

const REF_DIR = path.join('audio', 'reference-beats')
const RATE = 48000
// Analyse a slice from the middle: reference tracks are full songs, so the first
// 30s is usually intro/build and would not be compared against our 8s of groove.
const SLICE_SECONDS = 20
const SKIP_SECONDS = 45

function decode(file: string, skip: number, seconds: number): Float32Array {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error',
    '-ss', String(skip),
    '-t', String(seconds),
    '-i', file,
    '-ac', '1',              // mono — analyzePcm takes a single channel
    '-ar', String(RATE),
    '-f', 'f32le',
    '-',
  ], { maxBuffer: 1024 * 1024 * 512 })
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4))
}

function findOurWav(): string | null {
  const base = path.join('marketing', 'output', 'fire-beats')
  if (!fs.existsSync(base)) return null
  const hits: { p: string; t: number }[] = []
  for (const dir of fs.readdirSync(base)) {
    const d = path.join(base, dir)
    if (!fs.statSync(d).isDirectory()) continue
    for (const f of fs.readdirSync(d)) {
      if (/full.*\.wav$/i.test(f)) hits.push({ p: path.join(d, f), t: fs.statSync(path.join(d, f)).mtimeMs })
    }
  }
  hits.sort((a, b) => b.t - a.t)
  return hits[0]?.p ?? null
}

const fmt = (n: number | null, d = 1) => (n === null || !isFinite(n) ? '—' : n.toFixed(d))
const pct = (n: number) => (n * 100).toFixed(1) + '%'

function row(label: string, r: PcmAnalysisReport, dur: number): string {
  return [
    label.slice(0, 30).padEnd(30),
    fmt(r.rmsDb).padStart(7),
    fmt(r.crestFactor, 2).padStart(6),
    fmt(r.dynamicRangeDb).padStart(7),
    fmt(r.spectralCentroidHz, 0).padStart(7),
    pct(r.bandEnergy.sub).padStart(6),
    pct(r.bandEnergy.bass).padStart(6),
    pct(r.bandEnergy.lowMid).padStart(7),
    pct(r.bandEnergy.highMid).padStart(7),
    pct(r.bandEnergy.high).padStart(6),
    fmt(r.estimatedBpm, 0).padStart(5),
    fmt(r.onsetCount / dur, 1).padStart(6),
    fmt(r.onsetTimingStdDevMs).padStart(7),
  ].join(' ')
}

const HEADER = [
  'BEAT'.padEnd(30),
  'rmsDb'.padStart(7),
  'crest'.padStart(6),
  'dynRng'.padStart(7),
  'centHz'.padStart(7),
  'sub'.padStart(6),
  'bass'.padStart(6),
  'lowMid'.padStart(7),
  'hiMid'.padStart(7),
  'high'.padStart(6),
  'bpm'.padStart(5),
  'ons/s'.padStart(6),
  'onsSD'.padStart(7),
].join(' ')

function main(): void {
  if (!fs.existsSync(REF_DIR)) { console.error(`missing ${REF_DIR}`); process.exit(1) }
  const refs = fs.readdirSync(REF_DIR).filter((f) => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f))
  // One WAV/MP3 pair of the same track would double-count it.
  const seen = new Set<string>()
  const unique = refs.filter((f) => {
    const stem = f.replace(/\.[^.]+$/, '')
    if (seen.has(stem)) return false
    seen.add(stem); return true
  })

  console.log(`\nReference beats: ${unique.length}   (${SLICE_SECONDS}s from ${SKIP_SECONDS}s in)\n`)
  console.log(HEADER)
  console.log('─'.repeat(HEADER.length))

  const refReports: PcmAnalysisReport[] = []
  for (const f of unique) {
    try {
      const pcm = decode(path.join(REF_DIR, f), SKIP_SECONDS, SLICE_SECONDS)
      if (pcm.length < RATE) { console.log(`${f.slice(0, 30).padEnd(30)}  (too short / decode failed)`); continue }
      const r = analyzePcm(pcm, RATE)
      refReports.push(r)
      console.log(row(f, r, pcm.length / RATE))
    } catch (e) {
      console.log(`${f.slice(0, 30).padEnd(30)}  ERROR ${(e as Error).message.slice(0, 40)}`)
    }
  }

  if (!refReports.length) { console.error('\nno reference beats analysed'); process.exit(1) }

  // Mean of the references = the target.
  const mean = (pick: (r: PcmAnalysisReport) => number): number =>
    refReports.reduce((s, r) => s + (isFinite(pick(r)) ? pick(r) : 0), 0) / refReports.length

  const target = {
    rmsDb: mean((r) => r.rmsDb),
    crestFactor: mean((r) => r.crestFactor),
    dynamicRangeDb: mean((r) => r.dynamicRangeDb),
    spectralCentroidHz: mean((r) => r.spectralCentroidHz),
    sub: mean((r) => r.bandEnergy.sub),
    bass: mean((r) => r.bandEnergy.bass),
    lowMid: mean((r) => r.bandEnergy.lowMid),
    highMid: mean((r) => r.bandEnergy.highMid),
    high: mean((r) => r.bandEnergy.high),
    onsetSD: mean((r) => r.onsetTimingStdDevMs),
  }

  console.log('─'.repeat(HEADER.length))
  console.log([
    'REFERENCE MEAN (the target)'.padEnd(30),
    fmt(target.rmsDb).padStart(7),
    fmt(target.crestFactor, 2).padStart(6),
    fmt(target.dynamicRangeDb).padStart(7),
    fmt(target.spectralCentroidHz, 0).padStart(7),
    pct(target.sub).padStart(6),
    pct(target.bass).padStart(6),
    pct(target.lowMid).padStart(7),
    pct(target.highMid).padStart(7),
    pct(target.high).padStart(6),
    '—'.padStart(5), '—'.padStart(6),
    fmt(target.onsetSD).padStart(7),
  ].join(' '))

  const ourWav = process.argv[2] ?? findOurWav()
  if (!ourWav || !fs.existsSync(ourWav)) {
    console.log('\nNo capture found to compare. Run the fire-beats bench, then re-run this.')
    return
  }

  const ourPcm = decode(ourWav, 0, SLICE_SECONDS)
  const ours = analyzePcm(ourPcm, RATE)
  console.log('')
  console.log(row('OURS: ' + path.basename(ourWav), ours, ourPcm.length / RATE))

  console.log(`\n${'═'.repeat(72)}\nTHE GAP — ours minus the reference mean\n${'═'.repeat(72)}`)
  const gap = (name: string, mine: number, theirs: number, unit = '', good = 0.15) => {
    const d = mine - theirs
    const relative = theirs === 0 ? 0 : Math.abs(d / theirs)
    const flag = relative > good ? '  <<<' : ''
    console.log(`  ${name.padEnd(24)} ours ${fmt(mine, 2).padStart(8)}${unit}   ref ${fmt(theirs, 2).padStart(8)}${unit}   diff ${(d >= 0 ? '+' : '') + fmt(d, 2)}${flag}`)
  }
  gap('spectral centroid', ours.spectralCentroidHz, target.spectralCentroidHz, ' Hz')
  gap('sub 20-80Hz', ours.bandEnergy.sub * 100, target.sub * 100, ' %')
  gap('bass 80-250Hz', ours.bandEnergy.bass * 100, target.bass * 100, ' %')
  gap('lowMid 250-2k', ours.bandEnergy.lowMid * 100, target.lowMid * 100, ' %')
  gap('highMid 2k-6k', ours.bandEnergy.highMid * 100, target.highMid * 100, ' %')
  gap('high 6k-20k', ours.bandEnergy.high * 100, target.high * 100, ' %')
  gap('onset timing SD', ours.onsetTimingStdDevMs, target.onsetSD, ' ms')

  gap('crest factor', ours.crestFactor, target.crestFactor)
  gap('dynamic range dB', ours.dynamicRangeDb, target.dynamicRangeDb, ' dB')

  console.log('\n  <<< marks a gap over 15% relative — those are the dimensions to close first.')
  console.log('  Absolute LOUDNESS (rmsDb) is not a target — capture gain is arbitrary.')
  console.log('  Everything else IS. The references are finished, mastered instrumentals')
  console.log('  (from Voloco) meant to be rapped over, and there is NO mastering stage after')
  console.log('  the Organism: what it plays in the headphones is the finished product. It')
  console.log('  competes with these directly, so it has to reach this density on its own.')
  console.log('  WARNING: density is NOT more limiting. This repo already tried three')
  console.log('  compressors in series and it squashed the kick/snare transients flat. The')
  console.log('  job is raising the AVERAGE without flattening the hits.')
}

main()
