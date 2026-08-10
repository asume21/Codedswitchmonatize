// Fire Beats Capture Bench
// ─────────────────────────────────────────────────────────────────────────
// Records a repeatable, controlled test set so we can tune the Organism "by
// ear" without guessing which generator caused a problem. For each preset it
// pins ONE seed (deterministic performance), then captures the full mix plus
// each role in isolation (drums / bass / melody / chord / texture) by soloing
// one mix channel at a time. Saves labeled WAV + WebEar analysis JSON.
//
// This is GLUE over machinery that already exists — it does NOT reimplement:
//   • deterministic replay  → window.setFreeplaySeed(n)   (freeplay/utils.ts)
//   • per-role isolation     → window.soloChannel(role)    (useMixEngine.ts)
//   • capture tap            → window.__audioDebug.startCapture (audioDebugBridge)
//   • analysis               → GET /api/webear/analyze-app/:id (webearRelay)
//
// Usage:
//   node scripts/capture-fire-beats.mjs [label] [seed]
//     label : baseline | candidate   (default: candidate) — the A/B folder
//     seed  : integer                (default: 42)
//   BASE env overrides the dev origin (default http://localhost:5001).
//
// Compare two runs with the WebEar MCP diff_audio / groove_score / mix_coach
// tools, level-matched, once the WAVs are on disk.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE  = process.env.BASE || 'http://localhost:5001'
const LABEL = (process.argv[2] || 'candidate').replace(/[^a-z0-9-]/gi, '')
const SEED  = Number.parseInt(process.argv[3] || '42', 10)
const CAP_MS = Number(process.env.CAP_MS || 15000) // per-stem capture length; 15s gives the quality audit enough groove evidence
const OUT_DIR = path.join('marketing', 'output', 'fire-beats', LABEL)
const SYNC_SETTLE_MS = Number(process.env.SYNC_SETTLE_MS || 2500)

// Matches acceptance checklist (docs/superpowers/plans/2026-07-08-fire-beats-acceptance.md).
// label = exact button text on /organism (client/src/features/organism/QuickStartPresets.ts).
const ALL_PRESETS = [
  { key: 'trap',    label: 'Trap 144' },
  { key: 'drill',   label: 'Drill 144' },
  { key: 'boombap', label: 'Boom-bap' },
  { key: 'lofi',    label: 'Lo-fi' },
]
// PRESET=trap (or a comma list) limits the run to a subset — handy for a fast
// single-preset pass while tuning one thing. Unset = all four.
const PRESET_FILTER = (process.env.PRESET || '').split(',').map(s => s.trim()).filter(Boolean)
const PRESETS = PRESET_FILTER.length
  ? ALL_PRESETS.filter(p => PRESET_FILTER.includes(p.key))
  : ALL_PRESETS

// 'full' = no solo (whole mix); the rest solo one mix channel.
const STEMS = (process.env.STEMS || 'full,drum,bass,melody,chord,texture')
  .split(',')
  .map((stem) => stem.trim())
  .filter((stem) => ['full', 'drum', 'bass', 'melody', 'chord', 'texture'].includes(stem))

const log = (...a) => console.log('[fire-beats]', ...a)

function ffmpegToWav(webmPath, wavPath) {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-y', '-i', webmPath, '-acodec', 'pcm_s16le', '-ar', '44100', wavPath], {
      stdio: 'ignore',
    })
    child.on('error', () => resolve(false))       // ffmpeg missing → keep webm only
    child.on('exit', (code) => resolve(code === 0))
  })
}

async function clickByText(page, text) {
  const loc = page.getByText(text, { exact: false }).first()
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 5000 }).catch((e) => log('click fail', text, e.message))
    return true
  }
  return false
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  log(`label=${LABEL} seed=${SEED} → ${OUT_DIR}`)

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--mute-audio=false',
    ],
  })

  const manifestPath = path.join(OUT_DIR, 'manifest.json')
  const existingManifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null
  const manifest = existingManifest ?? {
    label: LABEL,
    seed: SEED,
    base: BASE,
    capturedAt: new Date().toISOString(),
    comparable: process.env.SONG_MODE !== '1',
    presets: {},
    captures: [],
  }
  manifest.label = LABEL
  manifest.seed = SEED
  manifest.base = BASE
  manifest.comparable = process.env.SONG_MODE !== '1'

  for (const preset of PRESETS) {
    // Allow a long full-song run and a shorter stem run to be assembled into
    // one evidence package without invalidating the earlier captures.
    manifest.captures = (manifest.captures ?? []).filter((capture) =>
      !(capture.preset === preset.key && STEMS.includes(capture.stem)))
    const page = await browser.newPage()

    // Intercept the capture upload POST so we get the raw audio bytes without
    // depending on any express port — the browser posts to /api/webear/blob/:id.
    const blobs = new Map() // captureId → Buffer
    page.on('request', (req) => {
      const m = req.url().match(/\/api\/webear\/blob\/([^/?]+)/)
      if (m && req.method() === 'POST') {
        const body = req.postDataBuffer()
        if (body) blobs.set(m[1], body)
      }
    })
    page.on('pageerror', (e) => log('PAGEERR>', e.message))

    log(`\n=== ${preset.key} (${preset.label}) ===`)
    await page.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(4000)

    // Pin the seed BEFORE starting so this performance is reproducible.
    const seedApplied = await page.evaluate((s) => {
      const fn = window.setFreeplaySeed
      return typeof fn === 'function' ? fn(s) : null
    }, SEED)
    log('seed pinned →', seedApplied)

    await clickByText(page, preset.label)
    await page.waitForTimeout(1500)
    for (const t of ['START', 'Start', 'Play', 'PLAY', '▶']) {
      if (await clickByText(page, t)) { log('started via', t); break }
    }
    await page.waitForTimeout(6000) // let the band build up

    // Pin the arrangement OFF (jam mode) unless SONG_MODE=1. With song mode on,
    // each stem is captured in whatever SECTION happens to be playing, and every
    // section applies different per-part gain multipliers — so two runs measure
    // two different arrangements and the levels are not comparable. (This is not
    // hypothetical: it produced a "+11 dB louder" melody reading immediately
    // after that channel's gain was LOWERED by 5 dB.) Jam mode holds the part
    // multipliers at ~1 so a stem's RMS actually reflects the mix.
    if (process.env.SONG_MODE !== '1') {
      const off = await page.evaluate(() => {
        const fn = window.songMode
        if (typeof fn !== 'function') return 'missing'
        fn(false)
        return 'off'
      })
      log('song mode →', off)
      await page.waitForTimeout(2000)
      await page.waitForFunction(() => {
        const report = window.__orgDebug?.()?.gainReport
        if (!report) return false
        return ['drum', 'bass', 'melody', 'chord', 'texture'].every((role) =>
          report[role]?.on === true && report[role]?.arr > 0.2 && report[role]?.gain > 0.1)
      }, null, { timeout: 10000 }).catch(() => log('jam-mode gain settling timeout — manifest will show the transition state'))
      await page.waitForTimeout(1200)
    }

    const ready = await page.evaluate(() => ({
      debug: !!window.__audioDebug,
      solo:  typeof window.soloChannel === 'function',
      organism: typeof window.__orgDebug === 'function',
      restart: typeof window.__orgRestartForAudit === 'function',
    }))
    log('ready:', JSON.stringify(ready))
    if (!ready.debug || !ready.solo) {
      log('SKIP preset — missing __audioDebug or soloChannel (is this the dev server on', BASE, '?)')
      await page.close()
      continue
    }
    if (ready.organism) {
      await page.waitForFunction(() => {
        const report = window.__orgDebug?.()?.gainReport
        return report?.melody?.part?.samplerLoaded === true &&
          report?.chord?.voice?.samplerLoaded === true &&
          report?.texture?.pad?.loaded === true
      }, null, { timeout: 15000 }).catch(() => log('voice readiness timeout — capture metadata will show the fallback'))
    }
    const presetRuntime = ready.organism ? await page.evaluate(() => window.__orgDebug?.() ?? null) : null
    manifest.presets[preset.key] = { label: preset.label, seed: seedApplied, runtime: presetRuntime }

    for (const [stemIndex, stem] of STEMS.entries()) {
      if (process.env.SYNC_STEMS === '1' && stemIndex > 0) {
        const restarted = await page.evaluate(async (seed) => {
          window.setFreeplaySeed?.(seed)
          return await window.__orgRestartForAudit?.() ?? false
        }, SEED)
        log('same-timeline restart →', restarted)
        await page.waitForTimeout(SYNC_SETTLE_MS)
      }
      const role = stem === 'full' ? null : stem
      await page.evaluate((r) => window.soloChannel(r), role)
      await page.waitForTimeout(1200) // ramp + settle before measuring

      const runtime = ready.organism ? await page.evaluate(() => window.__orgDebug?.() ?? null) : null
      const capId = await page.evaluate((ms) => window.__audioDebug.startCapture(ms), CAP_MS)
      const timeline = []
      const timelineStart = Date.now()
      while (Date.now() - timelineStart < CAP_MS) {
        await page.waitForTimeout(Math.min(4000, CAP_MS - (Date.now() - timelineStart)))
        const snapshot = ready.organism ? await page.evaluate(() => window.__orgDebug?.() ?? null) : null
        if (snapshot) {
          timeline.push({
            atMs: Date.now() - timelineStart,
            section: snapshot.section ?? null,
            chord: snapshot.chord ?? null,
            transport: snapshot.transport ?? null,
            gainReport: snapshot.gainReport ?? null,
          })
        }
      }
      await page.waitForTimeout(500) // let the upload POST land

      const base = `${preset.key}-${stem}-seed${SEED}`
      const record = {
        preset: preset.key,
        stem,
        captureId: capId,
        wav: null,
        analysis: null,
        section: runtime?.section ?? null,
        transport: runtime?.transport ?? null,
        timeline,
        generator: runtime?.gainReport?.[stem] ?? (stem === 'full' ? runtime?.gainReport ?? null : null),
      }

      const buf = blobs.get(capId)
      if (buf) {
        const webmPath = path.join(OUT_DIR, `${base}.webm`)
        const wavPath  = path.join(OUT_DIR, `${base}.wav`)
        fs.writeFileSync(webmPath, buf)
        const ok = await ffmpegToWav(webmPath, wavPath)
        if (ok) { fs.rmSync(webmPath); record.wav = wavPath }
        else    { record.wav = webmPath; log('  ffmpeg unavailable — kept .webm') }
      } else {
        log('  no audio bytes intercepted for', base)
      }

      const report = await page.evaluate(async (cid) => {
        try {
          const res = await fetch('/api/webear/analyze-app/' + cid)
          return { status: res.status, body: await res.text() }
        } catch (e) { return { status: 0, body: String(e) } }
      }, capId)
      if (report.status === 200) {
        const jsonPath = path.join(OUT_DIR, `${base}.json`)
        fs.writeFileSync(jsonPath, report.body)
        record.analysis = jsonPath
      }
      log(`  ${stem.padEnd(8)} → ${record.wav ? path.basename(record.wav) : 'no wav'} | analysis ${report.status}`)
      manifest.captures.push(record)
      // Persist incrementally so a long multi-stem audit remains recoverable if
      // a browser or network timeout happens during a later stem.
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    }

    await page.evaluate(() => window.soloChannel(null)) // un-solo before leaving
    await page.close()
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  await browser.close()
  log(`\nDone. ${manifest.captures.length} captures + manifest.json in ${OUT_DIR}`)
}

main().catch((err) => { console.error('[fire-beats] FATAL', err); process.exit(1) })
