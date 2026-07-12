// Autonomous Organism audio capture + analysis.
// Launches Chromium, loads /organism (public guest demo), starts a preset,
// triggers the in-page WebEar capture tap, then hits the no-auth analyzer.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = 'http://localhost:5001'
const PRESET = process.argv[2] || 'Cypher'   // preset label to click
const CAP_MS = 15000

const log = (...a) => console.log('[cap]', ...a)

const browser = await chromium.launch({
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--mute-audio=false',
  ],
})
const ctx = await browser.newContext()
const page = await ctx.newPage()

page.on('request', (req) => {
  if (req.url().includes('/api/webear/blob/')) {
    const postData = req.postDataBuffer()
    if (postData) {
      log('Intercepted audio upload, size:', postData.length)
      fs.mkdirSync('marketing/output', { recursive: true })
      fs.writeFileSync('marketing/output/organism-capture.webm', postData)
      log('Saved intercepted raw audio to marketing/output/organism-capture.webm')
    }
  }
})

page.on('console', (m) => {
  const t = m.text()
  if (/webear|audioDebug|tap|capture|organism|error/i.test(t)) log('PAGE>', t)
})
page.on('pageerror', (e) => log('PAGEERR>', e.message))

log('navigating to', BASE + '/organism')
await page.goto(BASE + '/organism', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)

// Dump candidate clickable labels so we know what's on screen.
const labels = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('button, [role=button], [class*=preset], [class*=card]')) {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    if (t) out.push(t)
  }
  return [...new Set(out)].slice(0, 60)
})
log('clickable labels:', JSON.stringify(labels))

// Try to click the preset, then any START/PLAY control.
async function clickByText(text) {
  const loc = page.getByText(text, { exact: false }).first()
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 5000 }).catch((e) => log('click fail', text, e.message))
    return true
  }
  return false
}

log('clicking preset:', PRESET)
await clickByText(PRESET)
await page.waitForTimeout(1500)
for (const t of ['START', 'Start', 'Play', 'PLAY', '▶']) {
  if (await clickByText(t)) { log('clicked control:', t); break }
}

// Let the band build up.
await page.waitForTimeout(6000)

const pre = await page.evaluate(() => ({
  hasDebug: !!window.__audioDebug,
  status: window.__audioDebug?.status?.() ?? 'none',
  webear: window.__audioDebug?.webearStatus?.()?.state ?? 'none',
}))
log('pre-capture state:', JSON.stringify(pre))

if (!pre.hasDebug) { log('FATAL: window.__audioDebug missing'); await browser.close(); process.exit(2) }

log('capturing', CAP_MS, 'ms ...')
const id = await page.evaluate((ms) => window.__audioDebug.startCapture(ms), CAP_MS)
log('capture id:', id)

// Analyze via the no-auth in-app endpoint (same origin → vite proxy → express).
const report = await page.evaluate(async (cid) => {
  const r = await fetch('/api/webear/analyze-app/' + cid)
  return { status: r.status, body: await r.text() }
}, id)
log('analyze status:', report.status)
log('REPORT:', report.body)

await browser.close()
