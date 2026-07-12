import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:5001'
const b = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream'] })
const p = await b.newPage()
await p.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.waitForTimeout(3000)
await p.evaluate(() => {
  window.__long = []
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)) })
    .observe({ entryTypes: ['longtask'] })
  window.__frames = []
  let last = performance.now()
  const tick = () => { const n = performance.now(); window.__frames.push(n - last); last = n; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})
for (const t of ['START','Start','Play']) { const l = p.getByText(t,{exact:false}).first(); if (await l.count().catch(()=>0)) { await l.click({timeout:5000}).catch(()=>{}); break } }
await p.waitForTimeout(30000)
console.log(await p.evaluate(() => {
  const L = window.__long || [], F = (window.__frames||[]).slice(30)
  F.sort((a,b)=>a-b)
  const pct = (q) => F.length ? F[Math.floor(F.length*q)].toFixed(1) : 'n/a'
  return JSON.stringify({
    longTasks: L.length,
    longTaskTotalMs: L.reduce((s,v)=>s+v,0),
    worstLongTaskMs: L.length ? Math.max(...L) : 0,
    over100ms: L.filter(v=>v>100).length,
    frameMs_p50: pct(0.5), frameMs_p95: pct(0.95), frameMs_worst: F.length ? F[F.length-1].toFixed(1) : 'n/a',
  })
}))
await b.close()
