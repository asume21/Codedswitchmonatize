// Feature Modes Capture Bench
// ─────────────────────────────────────────────────────────────────────────
// The fire-beats bench pins Song Mode OFF so stem levels are comparable — but
// setFeaturedPerformance force-enables Song Mode, and setSongModeEnabled(false)
// force-resets the feature to 'none' (OrganismProvider.tsx:3492-3498, 3747-3752).
// The two are mutually exclusive by design, so that bench can never capture a
// Full Song Feature. This one does the opposite: Song Mode stays ON, one
// feature is selected through the real Command Center button, and the FULL MIX
// is captured long enough to hear whether the feature is a performance or a
// looping riff.
//
// Levels here are NOT comparable across runs (each capture lands in whatever
// arrangement section is playing). This is a LISTENING bench, not a level A/B.
//
// Usage: node scripts/capture-feature-modes.mjs [label] [seed]

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:5001'
const LABEL = (process.argv[2] || 'feature-modes').replace(/[^a-z0-9-]/gi, '')
const SEED = Number.parseInt(process.argv[3] || '42', 10)
const CAP_MS = 14000 // long enough to hear a 4-bar solo arc refresh (4 bars @144 = 6.7s)
const PRESET_LABEL = process.env.PRESET_LABEL || 'Trap 144'
const OUT_DIR = path.join('marketing', 'output', 'fire-beats', LABEL)

// [feature value, exact button text in OrganismCommandCenter.tsx:2589-2594]
const FEATURES = [
  ['none', 'Band'],
  ['melody', 'Melody'],
  ['chord', 'Chords'],
  ['texture', 'Pads / Keys'],
  ['melody-chords', 'Melody + Chords'],
]

const log = (...a) => console.log('[feature-modes]', ...a)

function ffmpegToWav(webmPath, wavPath) {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-y', '-i', webmPath, '-acodec', 'pcm_s16le', '-ar', '44100', wavPath], {
      stdio: 'ignore',
    })
    child.on('error', () => resolve(false))
    child.on('exit', (code) => resolve(code === 0))
  })
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  log(`label=${LABEL} seed=${SEED} preset=${PRESET_LABEL} → ${OUT_DIR}`)

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--mute-audio=false',
    ],
  })

  const manifest = {
    label: LABEL,
    seed: SEED,
    base: BASE,
    preset: PRESET_LABEL,
    capturedAt: new Date().toISOString(),
    comparable: false,
    note: 'Song Mode ON (required by Full Song Feature). Cross-run levels are NOT comparable.',
    captures: [],
  }

  // One fresh page per feature so each run starts from the same seeded state
  // rather than inheriting the previous feature's phrase memory.
  for (const [feature, buttonText] of FEATURES) {
    const page = await browser.newPage()
    const blobs = new Map()
    page.on('request', (req) => {
      const m = req.url().match(/\/api\/webear\/blob\/([^/?]+)/)
      if (m && req.method() === 'POST') {
        const body = req.postDataBuffer()
        if (body) blobs.set(m[1], body)
      }
    })
    page.on('pageerror', (e) => log('PAGEERR>', e.message))

    log(`\n=== feature: ${feature} (button "${buttonText}") ===`)
    await page.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(4000)

    const seedApplied = await page.evaluate((s) => {
      const fn = window.setFreeplaySeed
      return typeof fn === 'function' ? fn(s) : null
    }, SEED)
    log('seed pinned →', seedApplied)

    const preset = page.getByText(PRESET_LABEL, { exact: false }).first()
    if (await preset.count().catch(() => 0)) {
      await preset.click({ timeout: 5000 }).catch((e) => log('preset click fail', e.message))
    }
    await page.waitForTimeout(1500)

    for (const t of ['START', 'Start', 'Play', 'PLAY', '▶']) {
      const loc = page.getByText(t, { exact: false }).first()
      if (await loc.count().catch(() => 0)) {
        await loc.click({ timeout: 5000 }).catch(() => {})
        log('started via', t)
        break
      }
    }
    await page.waitForTimeout(6000) // let the band build

    // Song Mode ON — the feature requires the section arc. Setting the feature
    // enables it too, but do it first so 'none' is captured under the same arc.
    await page.evaluate(() => {
      if (typeof window.songMode === 'function') window.songMode(true)
    })
    await page.waitForTimeout(2000)

    // Click the real Command Center button — exact role+name so "Melody" cannot
    // match "Lead (melody)" or "Melody + Chords".
    let clicked = 'not-found'
    const btn = page.getByRole('button', { name: buttonText, exact: true }).first()
    if (await btn.count().catch(() => 0)) {
      await btn.scrollIntoViewIfNeeded().catch(() => {})
      const err = await btn.click({ timeout: 5000 }).then(() => null).catch((e) => e.message)
      clicked = err ? `click-failed: ${err}` : 'ok'
    }
    log('feature button →', clicked)

    // Featured melody refreshes its solo phrase every 4 bars; give it a full
    // cycle to replace the pre-feature phrase before recording.
    await page.waitForTimeout(9000)

    const ready = await page.evaluate(() => ({
      debug: !!window.__audioDebug,
      organism: typeof window.__orgDebug === 'function',
    }))
    if (!ready.debug) {
      log('SKIP — no __audioDebug on', BASE)
      await page.close()
      continue
    }

    const runtime = ready.organism ? await page.evaluate(() => window.__orgDebug?.() ?? null) : null
    const capId = await page.evaluate((ms) => window.__audioDebug.startCapture(ms), CAP_MS)
    await page.waitForTimeout(CAP_MS + 1500)

    const base = `feature-${feature}-seed${SEED}`
    const record = {
      feature,
      button: buttonText,
      buttonClick: clicked,
      captureId: capId,
      wav: null,
      analysis: null,
      section: runtime?.section ?? null,
      transport: runtime?.transport ?? null,
      // The proof the feature actually engaged, rather than the UI claiming it.
      featuredFlags: {
        melody: runtime?.gainReport?.melody?.part?.featured ?? null,
        texture: runtime?.gainReport?.texture?.pad?.featured ?? null,
        chordLeadPocketed: runtime?.gainReport?.chord?.voice?.leadPocketed ?? null,
        texturePocketed: runtime?.gainReport?.texture?.pad?.leadPocketed ?? null,
      },
      voices: {
        melody: runtime?.gainReport?.melody?.part?.performerName ?? null,
        chord: runtime?.gainReport?.chord?.voice?.performerName ?? null,
        texture: runtime?.gainReport?.texture?.pad?.voice ?? null,
      },
      gains: ['drum', 'bass', 'melody', 'chord', 'texture'].reduce((acc, r) => {
        const g = runtime?.gainReport?.[r]
        acc[r] = g ? { gain: g.gain, arr: g.arr, on: g.on } : null
        return acc
      }, {}),
      melodyEvents: runtime?.gainReport?.melody?.part?.events ?? null,
    }

    const buf = blobs.get(capId)
    if (buf) {
      const webmPath = path.join(OUT_DIR, `${base}.webm`)
      const wavPath = path.join(OUT_DIR, `${base}.wav`)
      fs.writeFileSync(webmPath, buf)
      const ok = await ffmpegToWav(webmPath, wavPath)
      if (ok) { fs.rmSync(webmPath); record.wav = wavPath }
      else { record.wav = webmPath; log('  ffmpeg unavailable — kept .webm') }
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

    log(`  ${feature.padEnd(14)} → ${record.wav ? path.basename(record.wav) : 'NO WAV'} | analysis ${report.status} | featured=${JSON.stringify(record.featuredFlags)}`)
    manifest.captures.push(record)
    await page.close()
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await browser.close()
  log(`\nDone. ${manifest.captures.length} captures + manifest.json in ${OUT_DIR}`)
}

main().catch((err) => { console.error('[feature-modes] FATAL', err); process.exit(1) })
