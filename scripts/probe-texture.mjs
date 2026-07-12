import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5001'

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--mute-audio=false'],
})
const page = await browser.newPage()

const padLogs = []
page.on('console', (m) => {
  const t = m.text()
  if (/pad|texture|sampler|soundfont|Texture/i.test(t)) padLogs.push(t.slice(0, 160))
})
page.on('pageerror', (e) => padLogs.push('PAGEERR: ' + e.message.slice(0, 160)))

await page.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)

// Pick a preset first — same as the capture bench does.
const preset = process.env.PRESET_LABEL || 'Boom-bap'
{
  const loc = page.getByText(preset, { exact: false }).first()
  if (await loc.count().catch(() => 0)) { await loc.click({ timeout: 5000 }).catch(() => {}) }
  await page.waitForTimeout(1500)
}

// start it
for (const t of ['START', 'Start', 'Play', 'PLAY']) {
  const loc = page.getByText(t, { exact: false }).first()
  if (await loc.count().catch(() => 0)) { await loc.click({ timeout: 5000 }).catch(() => {}); break }
}

// Sample the meters over time so we see the intro -> verse -> drop progression.
for (const wait of [12000, 15000, 15000, 15000]) {
  await page.waitForTimeout(wait)
  const d = await page.evaluate(() => {
    const x = window.__orgDebug ? window.__orgDebug() : null
    return x ? { pos: x.transport?.position, section: x.section, ch: x.channelDb, master: x.masterDb?.rms } : null
  })
  console.log('t+', JSON.stringify(d))
}

const dump = await page.evaluate(() => {
  const d = window.__orgDebug ? window.__orgDebug() : null
  return d ? JSON.parse(JSON.stringify(d)) : null
})

console.log('=== __orgDebug ===')
console.log(JSON.stringify(dump, null, 1).slice(0, 2500))
console.log('\n=== pad/texture console lines ===')
console.log(padLogs.slice(0, 25).join('\n') || '(none)')

await browser.close()
