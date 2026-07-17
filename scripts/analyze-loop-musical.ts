/**
 * analyze-loop-musical.ts — extract each loop's MUSICAL DNA for Sample Leads.
 *
 * Companion to profile-loops.ts (which listens/measures vibe). This extracts
 * what the band needs to play WITH a loop instead of over it:
 *   • onsetGrid   — hit strength per 16th slot at the pack BPM (the bounce)
 *   • chordPerBar — best-fit triad per bar from pitch-class (chroma) energy
 *   • keyGuess    — best-fit key from aggregate chroma (Krumhansl-lite)
 * Writes clip.musical back into the pack JSON. Idempotent (skip unless --force).
 *
 * Usage:
 *   npx tsx scripts/analyze-loop-musical.ts                       # all packs
 *   npx tsx scripts/analyze-loop-musical.ts --pack boom-bap-85
 *   npx tsx scripts/analyze-loop-musical.ts --pack boom-bap-85 --dry
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import type { LoopPack, LoopClip, LoopMusical } from '../shared/loopPack'

const PACKS_DIR = join(process.cwd(), 'server', 'data', 'loop-packs')
const AUDIO_DIR = join(process.cwd(), 'server', 'Assets', 'loop-packs')
const POOLS = ['drums', 'bass', 'melody', 'chords', 'texture'] as const
const SR = 44100

const args = process.argv.slice(2)
const flag = (n: string) => args.includes(`--${n}`)
const val = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined }
const onlyPack = val('pack')
const force = flag('force')
const dry = flag('dry')

function clipPath(url: string): string | null {
  const m = url.match(/[?&]p=([^&]+)/)
  return m ? join(AUDIO_DIR, decodeURIComponent(m[1])) : null
}

function decodeToF32(path: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', path, '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'])
    const chunks: Buffer[] = []
    ff.stdout.on('data', (c: Buffer) => chunks.push(c))
    ff.stderr.on('data', () => {})
    ff.on('error', reject)
    ff.on('close', (code) => {
      const raw = Buffer.concat(chunks)
      if (raw.length < 4) return reject(new Error(`ffmpeg produced no samples (exit ${code})`))
      const usable = raw.length - (raw.length % 4)
      const copy = Buffer.from(raw.subarray(0, usable))
      resolve(new Float32Array(copy.buffer, copy.byteOffset, usable / 4))
    })
  })
}

// ── onset grid ──────────────────────────────────────────────────────────────
// Hit strength per 16th slot = energy in the slot's first 30ms minus the
// energy just before it (attack transient), averaged across bars.
function onsetGrid(pcm: Float32Array, bpm: number, bars: number): number[] {
  const slotLen = Math.floor(SR * 60 / (bpm * 4))
  const win = Math.min(Math.floor(SR * 0.03), slotLen)
  const rms = (start: number, len: number) => {
    let s = 0; const end = Math.min(start + len, pcm.length)
    if (start >= end) return 0
    for (let i = Math.max(0, start); i < end; i++) s += pcm[i] * pcm[i]
    return Math.sqrt(s / Math.max(1, end - Math.max(0, start)))
  }
  const grid = new Array(16).fill(0)
  const counts = new Array(16).fill(0)
  const totalSlots = bars * 16
  for (let s = 0; s < totalSlots; s++) {
    const at = s * slotLen
    if (at + win > pcm.length) break
    const attack = rms(at, win)
    const before = rms(at - win, win)
    const strength = Math.max(0, attack - before)
    grid[s % 16] += strength
    counts[s % 16]++
  }
  for (let i = 0; i < 16; i++) grid[i] = counts[i] ? grid[i] / counts[i] : 0
  const max = Math.max(...grid, 1e-9)
  return grid.map((v) => Math.round((v / max) * 1000) / 1000)
}

// ── chroma via Goertzel ─────────────────────────────────────────────────────
// Pitch-class energy over a sample window: Goertzel power at each semitone
// from MIDI 36 (C2) to 83 (B5), summed into 12 classes.
function chroma(pcm: Float32Array, start: number, len: number): number[] {
  const end = Math.min(start + len, pcm.length)
  const n = end - start
  const pc = new Array(12).fill(0)
  if (n < 1024) return pc
  // Downsample analysis stride for speed (every sample still fine at these
  // durations, but a stride of 2 halves the cost with negligible accuracy loss
  // below ~1kHz fundamentals).
  for (let midi = 36; midi <= 83; midi++) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const w = 2 * Math.PI * freq / SR
    const coeff = 2 * Math.cos(w)
    let s0 = 0, s1 = 0, s2 = 0
    for (let i = start; i < end; i++) {
      s0 = pcm[i] + coeff * s1 - s2
      s2 = s1; s1 = s0
    }
    const power = s1 * s1 + s2 * s2 - coeff * s1 * s2
    pc[midi % 12] += Math.max(0, power) / n
  }
  return pc
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function bestTriad(pc: number[]): { symbol: string; score: number; total: number } {
  const total = pc.reduce((a, b) => a + b, 0)
  let best = { symbol: 'C', score: -Infinity, total }
  for (let root = 0; root < 12; root++) {
    for (const [third, suffix] of [[4, ''], [3, 'm']] as const) {
      const score = pc[root] * 1.2 + pc[(root + third) % 12] + pc[(root + 7) % 12]
      if (score > best.score) best = { symbol: NOTE_NAMES[root] + suffix, score, total }
    }
  }
  return best
}

// Krumhansl-Schmuckler key profiles (major/minor), correlation against chroma.
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
function correlate(a: number[], b: number[]): number {
  const ma = a.reduce((x, y) => x + y, 0) / 12
  const mb = b.reduce((x, y) => x + y, 0) / 12
  let num = 0, da = 0, db = 0
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}
function bestKey(pc: number[]): string | null {
  const total = pc.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  let best: { symbol: string; r: number } | null = null
  for (let root = 0; root < 12; root++) {
    const rotated = pc.map((_, i) => pc[(i + root) % 12])
    const rMaj = correlate(rotated, MAJ)
    const rMin = correlate(rotated, MIN)
    if (!best || rMaj > best.r) best = { symbol: NOTE_NAMES[root], r: rMaj }
    if (rMin > best.r) best = { symbol: NOTE_NAMES[root] + 'm', r: rMin }
  }
  return best?.symbol ?? null
}

/** Pitched-content gate: drums/perc clips should not get fake chords. A clip
 *  counts as pitched when its chroma is concentrated (a few classes dominate)
 *  rather than flat noise. */
function isPitched(pc: number[]): boolean {
  const total = pc.reduce((a, b) => a + b, 0)
  if (total <= 1e-12) return false
  const sorted = [...pc].sort((a, b) => b - a)
  return (sorted[0] + sorted[1] + sorted[2]) / total > 0.45
}

async function analyzeClip(clip: LoopClip, bpm: number, pool: string): Promise<LoopMusical | null> {
  const path = clipPath(clip.url)
  if (!path || !existsSync(path)) { console.warn(`    ✗ file missing: ${clip.url}`); return null }
  const pcm = await decodeToF32(path)
  const bars = Math.max(1, clip.bars || 4)
  const grid = onsetGrid(pcm, bpm, bars)

  const barLen = Math.floor(SR * 60 / bpm) * 4
  const aggregate = new Array(12).fill(0)
  const chordPerBar: string[] = []
  const pitchedPool = pool !== 'drums'
  if (pitchedPool) {
    for (let b = 0; b < bars; b++) {
      const pc = chroma(pcm, b * barLen, barLen)
      for (let i = 0; i < 12; i++) aggregate[i] += pc[i]
      chordPerBar.push(bestTriad(pc).symbol)
    }
  }
  const pitched = pitchedPool && isPitched(aggregate)
  return {
    keyGuess: pitched ? bestKey(aggregate) : null,
    chordPerBar: pitched ? chordPerBar : [],
    onsetGrid: grid,
    analyzedAt: new Date().toISOString(),
  }
}

async function main() {
  const files = readdirSync(PACKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !onlyPack || f === `${onlyPack}.json`)
  if (!files.length) { console.error('No pack manifests found.'); process.exit(1) }

  let done = 0
  for (const file of files) {
    const path = join(PACKS_DIR, file)
    const pack = JSON.parse(readFileSync(path, 'utf-8')) as LoopPack
    console.log(`\n📦 ${pack.id} (${pack.bpm} BPM, key ${pack.key})`)
    let changed = false
    for (const pool of POOLS) {
      for (const clip of pack.loops[pool] ?? []) {
        if (clip.musical && !force) { console.log(`    • ${pool}/${clip.id} — analyzed (skip)`); continue }
        try {
          const musical = await analyzeClip(clip, pack.bpm, pool)
          if (!musical) continue
          if (!dry) { clip.musical = musical; changed = true }
          done++
          const hits = musical.onsetGrid.map((v, i) => (v > 0.4 ? i : -1)).filter((i) => i >= 0)
          console.log(`    ✓ ${pool}/${clip.id} — key:${musical.keyGuess ?? '-'} chords:[${musical.chordPerBar.join(' ')}] hits:[${hits.join(',')}]`)
        } catch (err: any) {
          console.warn(`    ✗ ${pool}/${clip.id} — ${err?.message ?? err}`)
        }
      }
    }
    if (changed && !dry) { writeFileSync(path, JSON.stringify(pack, null, 2) + '\n'); console.log(`    💾 wrote ${file}`) }
  }
  console.log(`\nDone. Analyzed ${done} clip(s).${dry ? ' (dry)' : ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
