// Blind A/B variant renderer
// ─────────────────────────────────────────────────────────────────────────
// The user, after a long day of tuning by measurement: "i look at those numbers and
// they mean nothing to me... i can say we have been close and i think if you could
// actually hear it we would have already achieved it but im almost no help because i
// cant figure out what to call things."
//
// He is not the problem. "What is wrong with it?" demands producer vocabulary. "Which
// of these two is better?" demands none, and carries the same information. So stop
// asking him to describe and start asking him to CHOOSE.
//
// You cannot run two Organisms at once — one AudioContext, one Transport. You do not
// need to: render the ONE engine twice with a pinned seed, so both takes are the same
// performance and differ only in the single thing being tested. Without the seed you
// are comparing two different beats and learning nothing.
//
// Everything varied here is adjustable at RUNTIME via window.__organismMix, so a
// variant costs one capture, not a rebuild.
//
// Usage:  node scripts/render-ab-variants.mjs [label] [seed]
// Then open the printed ab.html and click through the pairs.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:5001'
const LABEL = (process.argv[2] || 'ab').replace(/[^a-z0-9-]/gi, '')
const SEED = Number.parseInt(process.argv[3] || '42', 10)
const CAP_MS = 12000
const PRESET = process.env.PRESET_LABEL || 'Trap 144'
const OUT_DIR = path.join('marketing', 'output', 'ab', LABEL)

/**
 * Each variant is ONE change from the control, aimed at a gap the reference
 * comparison measured. Keep them single-variable — two changes at once and a
 * preference tells you nothing about which one caused it.
 *
 * Tweaks are DECLARATIVE DATA, not code strings: applyTweak below is a fixed
 * function, so nothing is ever compiled from text. (A dev tool has no untrusted
 * input, but a `new Function(body)` sitting in the repo is a foot-gun for whoever
 * extends it next.)
 */
const VARIANTS = [
  // TASK #4 — the drum loop itself. Everything is SOLOED to drums so the judgement
  // is about the loop and not about the band around it.
  { id: 'control', label: 'Control — current drums', tweak: { solo: 'drum' } },
  {
    id: 'looser',
    label: 'Looser timing (humanize x2.5)',
    // Measured: our onset spread is 6.0ms against 8.6ms in audio/reference-beats.
    // We are MORE metronomic than real hip-hop. This is the "mechanical" complaint
    // as a number, and it has never been tested by ear.
    tweak: { solo: 'drum', humanize: 2.5 },
  },
  {
    id: 'straight',
    label: 'Dead straight (humanize 0)',
    // The opposite direction. If this wins, the loop wants MORE grid, not less,
    // and the measurement was pointing the wrong way.
    tweak: { solo: 'drum', humanize: 0 },
  },
  {
    id: 'more-hats',
    label: 'Busier hats (density x1.35)',
    tweak: { solo: 'drum', hatDensity: 1.35 },
  },
  {
    id: 'harder-kick',
    label: 'Harder kick (velocity x1.2)',
    tweak: { solo: 'drum', kickVelocity: 1.2 },
  },
]

const log = (...a) => console.log('[ab]', ...a)

function ffmpegToWav(webm, wav) {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-y', '-i', webm, '-acodec', 'pcm_s16le', '-ar', '44100', wav], { stdio: 'ignore' })
    child.on('error', () => resolve(false))
    child.on('exit', (c) => resolve(c === 0))
  })
}

async function renderVariant(browser, variant) {
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

  await page.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)
  await page.evaluate((s) => window.setFreeplaySeed?.(s), SEED)

  const click = async (txt) => {
    const loc = page.getByText(txt, { exact: false }).first()
    if (await loc.count().catch(() => 0)) { await loc.click({ timeout: 5000 }).catch(() => {}); return true }
    return false
  }
  await click(PRESET)
  await page.waitForTimeout(1500)
  for (const t of ['START', 'Start', 'PLAY', 'Play']) if (await click(t)) break
  await page.waitForTimeout(9000)

  // Jam mode: the section arc would otherwise move the levels underneath the very
  // thing being compared.
  await page.evaluate(() => { if (typeof window.songMode === 'function') window.songMode(false) })
  await page.waitForTimeout(2000)

  const applied = await page.evaluate((tweak) => {
    const m = window.__organismMix
    if (!m) return 'no __organismMix'
    try {
      if (tweak.gains) for (const [ch, db] of Object.entries(tweak.gains)) m.setChannelGainDb(ch, db)
      if (tweak.feature) window.__orgSetFeature?.(tweak.feature)
      if (tweak.parallelComp) m.setParallelCompression(...tweak.parallelComp)
      if (typeof tweak.brightness === 'number') m.setMasterBrightness(tweak.brightness)
      const d = window.__drums
      if (d) {
        if (typeof tweak.humanize === 'number') d.humanize(tweak.humanize)
        if (typeof tweak.hatDensity === 'number') d.hatDensity(tweak.hatDensity)
        if (typeof tweak.kickVelocity === 'number') d.kickVelocity(tweak.kickVelocity)
      }
      if (tweak.csbl && typeof window.__csbl === 'function') window.__csbl(tweak.csbl)
      // SOLO last, so a drums-only comparison hears nothing but the change.
      if (tweak.solo && typeof window.soloChannel === 'function') window.soloChannel(tweak.solo)
      return 'ok'
    } catch (e) { return String(e) }
  }, variant.tweak)
  await page.waitForTimeout(2500)   // let the ramps settle before recording

  const capId = await page.evaluate((ms) => window.__audioDebug.startCapture(ms), CAP_MS)
  await page.waitForTimeout(CAP_MS + 1500)

  const buf = blobs.get(capId)
  let wav = null
  if (buf) {
    const webmPath = path.join(OUT_DIR, `${variant.id}.webm`)
    const wavPath = path.join(OUT_DIR, `${variant.id}.wav`)
    fs.writeFileSync(webmPath, buf)
    if (await ffmpegToWav(webmPath, wavPath)) { fs.rmSync(webmPath); wav = `${variant.id}.wav` }
    else wav = `${variant.id}.webm`
  }
  log(`${variant.id.padEnd(14)} apply=${applied}  ${wav ?? 'NO AUDIO'}`)
  await page.close()
  return { ...variant, wav }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--mute-audio=false'],
  })

  const rendered = []
  for (const v of VARIANTS) rendered.push(await renderVariant(browser, v))
  await browser.close()

  const usable = rendered.filter((r) => r.wav)
  // Every variant against the control — the control is the thing we are trying to beat.
  const control = usable.find((r) => r.id === 'control')
  const pairs = usable.filter((r) => r.id !== 'control').map((r) => ({ a: control, b: r }))

  fs.writeFileSync(path.join(OUT_DIR, 'ab.html'), buildPlayer(pairs, SEED))
  log(`\nDone. Open:  ${path.resolve(OUT_DIR, 'ab.html')}`)
}

function buildPlayer(pairs, seed) {
  const data = JSON.stringify(pairs.map((p) => ({
    aId: p.a.id, aWav: p.a.wav, aLabel: p.a.label,
    bId: p.b.id, bWav: p.b.wav, bLabel: p.b.label,
  })))
  return `<!doctype html><meta charset="utf-8"><title>Blind A/B — seed ${seed}</title>
<style>
 :root{color-scheme:dark}
 body{background:#0b0d10;color:#e8edf2;font:16px/1.5 system-ui;margin:0;padding:32px;max-width:720px;margin-inline:auto}
 h1{font-size:20px;margin:0 0 4px}
 p.sub{color:#8b98a5;margin:0 0 28px;font-size:14px}
 .card{background:#141920;border:1px solid #222b36;border-radius:14px;padding:22px;margin-bottom:18px}
 .row{display:flex;gap:14px;margin:16px 0}
 button{flex:1;padding:18px;border-radius:10px;border:1px solid #2c3846;background:#1b222c;color:#e8edf2;
        font:700 17px system-ui;cursor:pointer}
 button:hover{background:#232c38}
 .pick{border-color:#3ba55d;background:#17301f}
 .pick:hover{background:#1d3d28}
 .prog{color:#8b98a5;font-size:13px}
 #done{display:none;background:#12261a;border-color:#2f6b41}
 code{background:#0b0d10;padding:2px 6px;border-radius:5px;font-size:13px}
</style>
<h1>Which sounds better?</h1>
<p class="sub">Same beat, same seed — one thing changed. You are not told which is which,
and the order is shuffled. Play both, pick the better one. No right answer.</p>
<div class="card" id="card">
  <div class="prog" id="prog"></div>
  <div class="row">
    <button id="playA">▶ Play A</button>
    <button id="playB">▶ Play B</button>
  </div>
  <div class="row">
    <button class="pick" id="pickA">A is better</button>
    <button class="pick" id="pickB">B is better</button>
  </div>
  <div class="row"><button id="same" style="flex:0 0 auto;padding:10px 16px;font-size:14px">can't tell / same</button></div>
</div>
<div class="card" id="done"><b>Done — thank you.</b><div id="results" style="margin-top:12px"></div></div>
<script>
const PAIRS = ${data};
let i = 0, results = [], flip = [], audio = null;
PAIRS.forEach(() => flip.push(Math.random() < 0.5));
const $ = id => document.getElementById(id);
function play(which){
  if (audio) { audio.pause(); audio = null; }
  const p = PAIRS[i]; const swapped = flip[i];
  const file = (which === 'A') === !swapped ? p.aWav : p.bWav;
  audio = new Audio(file); audio.play();
}
function choose(which){
  const p = PAIRS[i], swapped = flip[i];
  let chosen = which === 'same' ? 'same' : ((which === 'A') === !swapped ? p.aId : p.bId);
  results.push({ pair: p.aId + ' vs ' + p.bId, chose: chosen, changed: p.bLabel });
  if (audio) { audio.pause(); audio = null; }
  i++; render();
}
function render(){
  if (i >= PAIRS.length){
    $('card').style.display='none'; $('done').style.display='block';
    const box = $('results');
    box.textContent = '';
    for (const r of results){
      const line = document.createElement('div');
      const c = document.createElement('code'); c.textContent = r.chose;
      const s = document.createElement('span'); s.style.color = '#8b98a5'; s.textContent = ' won — ' + r.changed;
      line.append(c, s); box.append(line);
    }
    const hint = document.createElement('p');
    hint.style.cssText = 'color:#8b98a5;font-size:13px;margin-top:14px';
    hint.textContent = 'Paste this back into the chat:';
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = JSON.stringify(results.map(r => r.chose + ' | ' + r.changed), null, 1);
    box.append(hint, pre);
    return;
  }
  $('prog').textContent = 'Pair ' + (i+1) + ' of ' + PAIRS.length;
}
$('playA').onclick=()=>play('A'); $('playB').onclick=()=>play('B');
$('pickA').onclick=()=>choose('A'); $('pickB').onclick=()=>choose('B');
$('same').onclick=()=>choose('same');
render();
</script>`
}

main().catch((e) => { console.error('[ab] FATAL', e); process.exit(1) })
