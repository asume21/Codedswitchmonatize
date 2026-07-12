import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:5001'
const b = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream'] })
const p = await b.newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message.slice(0,140)))
await p.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.waitForTimeout(4000)
for (const t of ['START','Start','Play']) { const l = p.getByText(t,{exact:false}).first(); if (await l.count().catch(()=>0)) { await l.click({timeout:5000}).catch(()=>{}); break } }
await p.waitForTimeout(9000)
console.log(await p.evaluate(() => JSON.stringify({
  solo: typeof window.soloChannel, debug: typeof window.__audioDebug,
  orgDebug: typeof window.__orgDebug, mix: typeof window.__organismMix, seed: typeof window.setFreeplaySeed,
})))
console.log('ERRORS:', errs.slice(0,6).join(' | ') || 'none')
await b.close()
