// Voice-accumulation probe — the crackle/cutout hunt
// ─────────────────────────────────────────────────────────────────────────
// Runs the instrument that already exists (client/src/lib/audioNodeCensus.ts,
// window.__nodeCensus) over consecutive equal-length windows and prints them
// side by side with the stall rate and the generators' event counts.
//
// The hypothesis under test (project memory, 2026-08-08): stall rate climbs
// 0.14% stopped -> 51.7% -> 100% while notes-per-bar stays constant and the JS
// heap stays flat. Rising AUDIO cost with flat JS cost points at voices created
// on the render thread and never released.
//
// The tell: a node type whose netLive climbs steadily across equal windows
// WHILE the Part event counts hold flat. Flat netLive falsifies the hypothesis
// and sends the hunt elsewhere.
//
// READ THE CAVEAT: headless Chromium has no real output device, so the STALL
// RATE here is not necessarily representative of the user's machine. The node
// census is sink-independent and is the trustworthy half of this output.
//
// Usage: node scripts/probe-voice-census.mjs [windows] [windowSeconds]

import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5001'
const WINDOWS = Number.parseInt(process.argv[2] || '6', 10)
const WINDOW_S = Number.parseInt(process.argv[3] || '10', 10)
const PRESET = process.env.PRESET_LABEL || 'Trap 144'

const log = (...a) => console.log('[census]', ...a)

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--mute-audio=false',
    ],
  })
  const page = await browser.newPage()
  page.on('pageerror', (e) => log('PAGEERR>', e.message))

  log(`${BASE}/organism — ${WINDOWS} windows x ${WINDOW_S}s`)
  await page.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)

  const has = await page.evaluate(() => ({
    census: typeof window.__nodeCensus === 'function',
    health: typeof window.__audioHealth === 'function',
    org: typeof window.__orgDebug === 'function',
  }))
  log('instruments:', JSON.stringify(has))
  if (!has.census) {
    log('FATAL — __nodeCensus missing. It installs as an import side effect in DEV;')
    log('is this the vite dev server on', BASE, '?')
    await browser.close()
    process.exit(1)
  }

  // Baseline while STOPPED: the memory measured 0.14% stalls with the whole
  // graph built and rendering silence. Anything the census shows here is the
  // idle floor, not the leak.
  await page.evaluate(() => window.__nodeCensus.mark())
  await page.waitForTimeout(WINDOW_S * 1000)
  const idle = await page.evaluate(() => ({
    census: window.__nodeCensus(),
    health: window.__audioHealth?.() ?? null,
  }))
  log(`\nIDLE (stopped) ${idle.census.windowMs}ms`)
  log('  ' + JSON.stringify(idle.census.perType))

  // Start the band.
  const preset = page.getByText(PRESET, { exact: false }).first()
  if (await preset.count().catch(() => 0)) await preset.click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(1200)
  for (const t of ['START', 'Start', 'Play', 'PLAY', '▶']) {
    const loc = page.getByText(t, { exact: false }).first()
    if (await loc.count().catch(() => 0)) {
      await loc.click({ timeout: 5000 }).catch(() => {})
      log('started via', t)
      break
    }
  }
  await page.waitForTimeout(6000) // let the band build before the first window

  let prevHealth = await page.evaluate(() => window.__audioHealth?.() ?? null)
  const rows = []

  for (let w = 0; w < WINDOWS; w++) {
    await page.evaluate(() => window.__nodeCensus.mark())
    await page.waitForTimeout(WINDOW_S * 1000)

    const s = await page.evaluate(() => ({
      census: window.__nodeCensus(),
      health: window.__audioHealth?.() ?? null,
      org: window.__orgDebug?.() ?? null,
    }))

    // Health counters are CUMULATIVE and must be read as a delta rate — reading
    // the running percentage is the trap that cost a previous session hours.
    const dChecks = (s.health?.totalChecks ?? 0) - (prevHealth?.totalChecks ?? 0)
    const dStalls = (s.health?.realStallCount ?? 0) - (prevHealth?.realStallCount ?? 0)
    prevHealth = s.health

    const g = s.org?.gainReport ?? {}
    const events = {
      drum: g.drum?.part?.events ?? null,
      melody: g.melody?.part?.events ?? null,
    }

    const src = s.census.perType?.AudioBufferSourceNode ?? null
    const osc = s.census.perType?.OscillatorNode ?? null
    const gain = s.census.perType?.GainNode ?? null

    rows.push({
      window: w + 1,
      stallPct: dChecks ? ((dStalls / dChecks) * 100).toFixed(1) : 'n/a',
      bufSrc: src ? `${src.created}c/${src.ended}e/net ${src.netLive}` : '-',
      osc: osc ? `${osc.created}c/${osc.ended}e/net ${osc.netLive}` : '-',
      gain: gain ? `${gain.created}c/${gain.disconnected}d/net ${gain.netLive}` : '-',
      drumEvents: events.drum,
      melodyEvents: events.melody,
    })
    log(`window ${w + 1}/${WINDOWS}  stalls ${rows.at(-1).stallPct}%  bufSrc ${rows.at(-1).bufSrc}`)
  }

  console.log('\n=== consecutive equal windows ===')
  console.table(rows)
  console.log(
    '\nnetLive climbing across windows while drum/melody event counts hold flat\n' +
    '= voices created and never released. Flat netLive falsifies the hypothesis.\n' +
    'Stall % from headless is NOT representative — no real output device.',
  )

  await browser.close()
}

main().catch((err) => { console.error('[census] FATAL', err); process.exit(1) })
