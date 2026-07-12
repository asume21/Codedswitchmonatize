import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:5001'
const b = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream'] })
const p = await b.newPage()
await p.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.waitForTimeout(4000)
for (const t of ['START','Start','Play']) { const l = p.getByText(t,{exact:false}).first(); if (await l.count().catch(()=>0)) { await l.click({timeout:5000}).catch(()=>{}); break } }
await p.waitForTimeout(10000)
console.log(await p.evaluate(() => {
  const mix = window.__organismMix
  if (!mix || !mix.config) return 'no config'
  const c = mix.config.channels
  return JSON.stringify({ chord: c.chord.gainDb, texture: c.texture.gainDb, melody: c.melody.gainDb, master: mix.config.master?.gainDb })
}))
await b.close()
