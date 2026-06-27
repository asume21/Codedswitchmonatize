/**
 * profile-loops.ts — WebEar listens to every loop and writes its profile card.
 *
 * Step 1 of the loop-arranger plan: before the AI can arrange loops into a fire
 * beat, it has to KNOW what each loop is. This runs OFFLINE (no browser): for
 * every clip in every pack manifest it
 *   1. LISTENS  — describeAudio() (Gemini multimodal, free tier) → plain English
 *   2. MEASURES — analyzePcm() (DSP) → energy / brightness / busyness / bands
 * and writes the result back into the pack JSON as clip.profile.
 *
 * Idempotent: clips that already have a profile are skipped unless --force.
 *
 * Usage:
 *   tsx scripts/profile-loops.ts                       # profile all packs
 *   tsx scripts/profile-loops.ts --pack cymatics-trap-140
 *   tsx scripts/profile-loops.ts --pack cymatics-trap-140 --limit 1 --dry
 *   tsx scripts/profile-loops.ts --force               # re-profile everything
 *
 * Flags:
 *   --pack <id>   only this pack
 *   --limit <n>   stop after n clips (testing — keeps Gemini calls cheap)
 *   --force       re-profile clips that already have a profile
 *   --dry         do everything but DON'T write the manifests (preview)
 */
import { config } from 'dotenv'
// override:true — a stale GEMINI_API_KEY in the actual shell/system environment
// otherwise wins over .env (dotenv never overrides an existing env var), which
// silently kept an old/invalid key in use even after .env was updated.
config({ override: true })
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { describeAudio } from '../server/services/audioDescribe'
import { analyzePcm } from '../server/services/mcpAudioAnalysis'
import type { LoopPack, LoopClip, LoopProfile } from '../shared/loopPack'

const PACKS_DIR = join(process.cwd(), 'server', 'data', 'loop-packs')
const AUDIO_DIR = join(process.cwd(), 'server', 'Assets', 'loop-packs')
const POOLS = ['drums', 'bass', 'melody', 'chords', 'texture'] as const

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const val = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const onlyPack = val('pack')
const limit = val('limit') ? parseInt(val('limit')!, 10) : Infinity
const force = flag('force')
const dry = flag('dry')

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Resolve a clip.url (`/api/loops/pack-audio?p=<rel>`) to its file on disk. */
function clipPath(url: string): string | null {
  const m = url.match(/[?&]p=([^&]+)/)
  if (!m) return null
  return join(AUDIO_DIR, decodeURIComponent(m[1]))
}

/** Decode any audio file to mono 44.1kHz Float32 PCM via ffmpeg. */
function decodeToF32(path: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', path, '-f', 'f32le', '-ac', '1', '-ar', '44100', 'pipe:1'])
    const chunks: Buffer[] = []
    ff.stdout.on('data', (c: Buffer) => chunks.push(c))
    ff.stderr.on('data', () => {})
    ff.on('error', reject)
    ff.on('close', (code) => {
      const raw = Buffer.concat(chunks)
      if (raw.length < 4) return reject(new Error(`ffmpeg decode produced no samples (exit ${code})`))
      // Copy into a fresh, 4-byte-aligned buffer so Float32Array can wrap it.
      const usable = raw.length - (raw.length % 4)
      const copy = Buffer.from(raw.subarray(0, usable))
      resolve(new Float32Array(copy.buffer, copy.byteOffset, usable / 4))
    })
  })
}

async function profileClip(clip: LoopClip): Promise<LoopProfile | null> {
  const path = clipPath(clip.url)
  if (!path || !existsSync(path)) {
    console.warn(`    ✗ file missing: ${clip.url}`)
    return null
  }
  const buf = readFileSync(path)

  // 1. LISTEN (Gemini multimodal)
  const description = (await describeAudio(buf)).trim()

  // 2. MEASURE (DSP)
  const pcm = await decodeToF32(path)
  const r = analyzePcm(pcm, 44100)

  // Normalize the raw metrics into the 0–1 dials the arranger reasons over.
  const energy = clamp01((r.rmsDb + 30) / 24)               // ~ -30dB→0, -6dB→1
  const brightness = clamp01((r.spectralCentroidHz - 200) / 5800) // 200Hz→0, 6kHz→1
  const onsetsPerSec = r.durationSeconds > 0 ? r.onsetCount / r.durationSeconds : 0
  const busyness = clamp01(onsetsPerSec / 8)                // 8 onsets/s ≈ very busy

  return {
    description,
    energy: round3(energy),
    brightness: round3(brightness),
    busyness: round3(busyness),
    bands: {
      sub:     round3(r.bandEnergy.sub),
      bass:    round3(r.bandEnergy.bass),
      lowMid:  round3(r.bandEnergy.lowMid),
      highMid: round3(r.bandEnergy.highMid),
      high:    round3(r.bandEnergy.high),
    },
    metrics: {
      rmsDb: round3(r.rmsDb),
      spectralCentroidHz: Math.round(r.spectralCentroidHz),
      estimatedBpm: r.estimatedBpm,
      onsetCount: r.onsetCount,
    },
    profiledAt: new Date().toISOString(),
  }
}

async function main() {
  const files = readdirSync(PACKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !onlyPack || f === `${onlyPack}.json`)

  if (files.length === 0) {
    console.error(onlyPack ? `No pack "${onlyPack}.json" found.` : 'No pack manifests found.')
    process.exit(1)
  }

  let done = 0
  let attempts = 0
  for (const file of files) {
    const path = join(PACKS_DIR, file)
    const pack = JSON.parse(readFileSync(path, 'utf-8')) as LoopPack
    console.log(`\n📦 ${pack.id}  (${pack.label})`)
    let changed = false

    for (const pool of POOLS) {
      for (const clip of pack.loops[pool] ?? []) {
        if (attempts >= limit) break
        if (clip.profile && !force) {
          console.log(`    • ${pool}/${clip.id} — already profiled (skip)`)
          continue
        }
        attempts++
        try {
          const profile = await profileClip(clip)
          if (!profile) continue
          if (!dry) { clip.profile = profile; changed = true }
          done++
          console.log(
            `    ✓ ${pool}/${clip.id} — e:${profile.energy} br:${profile.brightness} ` +
            `busy:${profile.busyness} — "${profile.description.slice(0, 70).replace(/\s+/g, ' ')}…"`,
          )
          // Be gentle on the Gemini free-tier rate limit (~15 req/min). ~4.2s
          // spacing keeps us under it; throttled clips just log ✗ and are
          // re-runnable later (idempotent — they have no profile yet).
          await new Promise((res) => setTimeout(res, 4200))
        } catch (err: any) {
          console.warn(`    ✗ ${pool}/${clip.id} — ${err?.message ?? err}`)
        }
      }
    }

    if (changed && !dry) {
      writeFileSync(path, JSON.stringify(pack, null, 2) + '\n')
      console.log(`    💾 wrote ${file}`)
    }
    if (attempts >= limit) break
  }

  console.log(`\nDone. Profiled ${done} clip(s).${dry ? ' (dry run — nothing written)' : ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
