/**
 * profile-samples.ts — DSP-profile every WAV in one or more directories.
 *
 * Unlike loop profiling (which calls Gemini for long phrases), individual drum
 * hits are profiled with DSP only — fast, free, and accurate for one-shots.
 *
 * Output: server/data/sample-profiles.json
 *   { "samples": { "<absolute-path>": SampleProfile, ... } }
 *
 * Idempotent: files that already have a profile are skipped unless --force.
 *
 * Usage:
 *   tsx scripts/profile-samples.ts "D:/wav"
 *   tsx scripts/profile-samples.ts "D:/wav" "C:/Users/ralsu/Downloads/Drums"
 *   tsx scripts/profile-samples.ts "D:/wav" --force     # re-profile everything
 *   tsx scripts/profile-samples.ts "D:/wav" --dry       # preview, no write
 *   tsx scripts/profile-samples.ts "D:/wav" --limit 50  # stop after 50 files
 *
 * After profiling, the AI (DrumGenerator / conductor) can load this manifest
 * and pick samples whose sub/bass/brightness/energy match the target section.
 */
import { config } from 'dotenv'
config({ override: true })

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs'
import { join, extname, basename, resolve } from 'path'
import { spawn } from 'child_process'
import { analyzePcm } from '../server/services/mcpAudioAnalysis'

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const val = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }

const dirs = args.filter((a) => !a.startsWith('--') && a !== val('limit'))
const force = flag('force')
const dry = flag('dry')
const limit = val('limit') ? parseInt(val('limit')!, 10) : Infinity

if (dirs.length === 0) {
  console.error('Usage: tsx scripts/profile-samples.ts <dir> [<dir2> ...] [--force] [--dry] [--limit N]')
  process.exit(1)
}

// ── output ─────────────────────────────────────────────────────────────────
const OUT_PATH = join(process.cwd(), 'server', 'data', 'sample-profiles.json')

export interface SampleProfile {
  category:           string   // kick | snare | hihat | clap | 808 | perc | bass | melody | other
  energy:             number   // 0–1
  brightness:         number   // 0–1  (spectral centroid normalised)
  punch:              number   // 0–1  (crest factor normalised — how transient-y)
  subWeight:          number   // 0–1  (sub band fraction — how much low-end rumble)
  bassWeight:         number   // 0–1  (bass band fraction)
  durationMs:         number
  rmsDb:              number
  spectralCentroidHz: number
  profiledAt:         string
}

interface ProfileDb {
  profiledAt: string
  count:      number
  samples:    Record<string, SampleProfile>
}

// ── category inference from filename ─────────────────────────────────────
function inferCategory(filename: string): string {
  const n = filename.toLowerCase()
  if (/\b(kick|bd|bass.?drum|kik|kck)\b/.test(n)) return 'kick'
  if (/\b(snare|sd|snr|snr)\b/.test(n))           return 'snare'
  if (/\b(808|sub.?bass|trap.?bass)\b/.test(n))   return '808'
  if (/\b(hat|hh|hihat|hi.?hat)\b/.test(n)) {
    if (/\b(open|op)\b/.test(n)) return 'open-hat'
    return 'hihat'
  }
  if (/\b(clap|clp|handclap)\b/.test(n))          return 'clap'
  if (/\b(tom|rim|cym|cymbal|perc|shaker|tamb|cowbell|clave)\b/.test(n)) return 'perc'
  if (/\b(bass|bassline)\b/.test(n))               return 'bass'
  if (/\b(piano|keys|lead|melody|synth|chord|pad)\b/.test(n)) return 'melody'
  return 'other'
}

// ── WAV walker ────────────────────────────────────────────────────────────
function walkWavs(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) {
    console.warn(`⚠️  Directory not found: ${dir}`)
    return results
  }
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      const st = statSync(full)
      if (st.isDirectory()) {
        results.push(...walkWavs(full))
      } else if (/\.(wav|WAV)$/.test(entry) && st.size > 100) {
        results.push(full)
      }
    } catch { /* skip inaccessible entries */ }
  }
  return results
}

// ── decode to F32 PCM via ffmpeg ──────────────────────────────────────────
function decodeToF32(filePath: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', filePath, '-f', 'f32le', '-ac', '1', '-ar', '44100', 'pipe:1'])
    const chunks: Buffer[] = []
    ff.stdout.on('data', (c: Buffer) => chunks.push(c))
    ff.stderr.on('data', () => {})
    ff.on('error', reject)
    ff.on('close', (code) => {
      const raw = Buffer.concat(chunks)
      if (raw.length < 4) return reject(new Error(`ffmpeg produced no output (exit ${code})`))
      const usable = raw.length - (raw.length % 4)
      const copy = Buffer.from(raw.subarray(0, usable))
      resolve(new Float32Array(copy.buffer, copy.byteOffset, usable / 4))
    })
  })
}

// ── profile one file ──────────────────────────────────────────────────────
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const round3  = (n: number) => Math.round(n * 1000) / 1000

async function profileFile(filePath: string): Promise<SampleProfile> {
  const pcm = await decodeToF32(filePath)
  const r = analyzePcm(pcm, 44100)

  const energy     = clamp01((r.rmsDb + 30) / 24)
  const brightness = clamp01((r.spectralCentroidHz - 200) / 5800)
  // Crest factor: peak/rms ratio — high = very transient (snappy hits), low = sustained (pads)
  const punch      = clamp01((r.crestFactor - 1) / 19)   // 1 = sustained, 20 = very transient

  return {
    category:           inferCategory(basename(filePath)),
    energy:             round3(energy),
    brightness:         round3(brightness),
    punch:              round3(punch),
    subWeight:          round3(r.bandEnergy.sub),
    bassWeight:         round3(r.bandEnergy.bass),
    durationMs:         Math.round(r.durationSeconds * 1000),
    rmsDb:              round3(r.rmsDb),
    spectralCentroidHz: Math.round(r.spectralCentroidHz),
    profiledAt:         new Date().toISOString(),
  }
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  // Load existing DB (idempotent)
  let db: ProfileDb = { profiledAt: new Date().toISOString(), count: 0, samples: {} }
  if (existsSync(OUT_PATH)) {
    try { db = JSON.parse(readFileSync(OUT_PATH, 'utf-8')) } catch {}
  }

  // Collect all WAV files from all requested dirs
  const allFiles: string[] = []
  for (const dir of dirs) {
    const found = walkWavs(resolve(dir))
    console.log(`📁 ${dir} — ${found.length} WAVs`)
    allFiles.push(...found)
  }
  console.log(`\n🎵 Total: ${allFiles.length} WAV files found`)

  let done = 0, skipped = 0, errors = 0, attempts = 0

  for (const filePath of allFiles) {
    if (attempts >= limit) break

    const key = resolve(filePath)
    if (db.samples[key] && !force) {
      skipped++
      continue
    }

    attempts++
    try {
      const profile = await profileFile(filePath)
      if (!dry) {
        db.samples[key] = profile
      }
      done++
      if (done % 50 === 0 || done <= 5) {
        console.log(
          `  ✓ [${done}] ${basename(filePath)} — ${profile.category} ` +
          `e:${profile.energy} br:${profile.brightness} sub:${profile.subWeight}`
        )
      }
    } catch (err: any) {
      errors++
      if (errors <= 10) console.warn(`  ✗ ${basename(filePath)} — ${err?.message ?? err}`)
    }
  }

  if (!dry) {
    db.profiledAt = new Date().toISOString()
    db.count = Object.keys(db.samples).length
    mkdirSync(join(process.cwd(), 'server', 'data'), { recursive: true })
    writeFileSync(OUT_PATH, JSON.stringify(db, null, 2) + '\n')
    console.log(`\n💾 Wrote ${db.count} total profiles to server/data/sample-profiles.json`)
  }

  console.log(`\nDone. Profiled: ${done} | Skipped (already done): ${skipped} | Errors: ${errors}${dry ? ' (dry run)' : ''}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
