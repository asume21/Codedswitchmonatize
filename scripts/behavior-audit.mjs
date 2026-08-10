// Behavior Audit
// ────────────────────────────────────────────────────────────────────────────
// Finds contradictions between what Organism controls promise and what the
// running app actually reports. This is deliberately contract-driven: it is
// not a generic linter and it does not replace unit tests or the audio capture
// bench.
//
// Usage:
//   node scripts/behavior-audit.mjs [label]
//   BASE=http://localhost:5001 PRESET_LABEL="Trap 144" node scripts/behavior-audit.mjs

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5001'
const PRESET_LABEL = process.env.PRESET_LABEL || 'Trap 144'
const LABEL = (process.argv[2] || 'latest').replace(/[^a-z0-9-]/gi, '')
const OUT_DIR = path.join('marketing', 'output', 'behavior-audit')
const startedAt = new Date().toISOString()

const findings = []
const pageErrors = []
const log = (...args) => console.log('[behavior-audit]', ...args)

function check(name, pass, details = '', severity = 'FAIL') {
  const finding = { name, pass: Boolean(pass), severity: pass ? 'PASS' : severity, details }
  findings.push(finding)
  console.log(`${pass ? 'PASS' : severity}  ${name}${details ? ` — ${details}` : ''}`)
  return pass
}

function allLoaded(samples) {
  if (!samples?.voices) return false
  return Object.values(samples.voices).every((voice) => voice.total > 0 && voice.loaded === voice.total && voice.errors === 0)
}

function sourceContractChecks() {
  const files = {
    commandCenter: 'client/src/features/organism/OrganismCommandCenter.tsx',
    context: 'client/src/features/organism/OrganismContext.tsx',
    provider: 'client/src/features/organism/OrganismProvider.tsx',
    orchestrator: 'client/src/organism/generators/GeneratorOrchestrator.ts',
    capture: 'scripts/capture-fire-beats.mjs',
  }
  const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]))
  check('feature control exists in Command Center', /setFeaturedPerformance\(feature\)/.test(text.commandCenter))
  check('feature setter is exposed by context', /setFeaturedPerformance/.test(text.context))
  check('provider forwards feature state to orchestrator', /orchestr\?\.setFeaturedPerformance\(feature\)/.test(text.provider))
  check('orchestrator owns feature routing', /setFeaturedPerformance\(feature: FeaturedPerformance\)/.test(text.orchestrator))
  check('capture bench records runtime state', /__orgDebug/.test(text.capture))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  sourceContractChecks()

  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--mute-audio=false'],
  })
  const page = await browser.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(`${BASE}/organism`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(3500)

  const hooks = await page.evaluate(() => ({
    debug: typeof window.__orgDebug === 'function',
    health: typeof window.__audioHealth === 'function',
    census: typeof window.__nodeCensus === 'function',
    seed: typeof window.setFreeplaySeed === 'function',
    solo: typeof window.soloChannel === 'function',
  }))
  for (const [name, present] of Object.entries(hooks)) check(`runtime hook: ${name}`, present)

  check('preset button exists', await page.getByRole('button', { name: PRESET_LABEL, exact: false }).count() > 0, PRESET_LABEL)
  await page.evaluate((seed) => window.setFreeplaySeed?.(seed), 4242)
  await page.getByText(PRESET_LABEL, { exact: false }).first().click().catch(() => {})
  await page.waitForTimeout(1200)
  for (const label of ['START', 'Start', 'Play', 'PLAY', '▶']) {
    const button = page.getByText(label, { exact: false }).first()
    if (await button.count().catch(() => 0)) {
      await button.click().catch(() => {})
      break
    }
  }

  await page.waitForFunction(() => window.__orgDebug?.()?.transport?.state === 'started', null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3500)
  const settled = await page.waitForFunction(() => {
    const report = window.__orgDebug?.()?.gainReport
    return report?.melody?.part?.samplerLoaded === true &&
      report?.melody?.part?.state === 'started' &&
      report?.chord?.voice?.samplerLoaded === true &&
      report?.texture?.pad?.loaded === true
  }, null, { timeout: 15000 }).then(() => true).catch(() => false)
  check('samplers and generator Parts settle before inspection', settled, '15-second readiness window')
  const runtime = await page.evaluate(() => window.__orgDebug?.() ?? null)
  const report = runtime?.gainReport ?? {}

  check('Transport is started', runtime?.transport?.state === 'started', JSON.stringify(runtime?.transport ?? null))
  check('audio context is running', runtime?.ctxState === 'running', String(runtime?.ctxState))
  check('all five generator reports exist', ['drum', 'bass', 'melody', 'chord', 'texture'].every((role) => report[role]), JSON.stringify(Object.keys(report)))
  check('drum Part is scheduled', report.drum?.part?.hasPart && report.drum.part.events > 0 && report.drum.part.started)
  check('melody Part is scheduled', report.melody?.part?.hasPart && report.melody.part.events > 0 && report.melody.part.state === 'started')
  check('melody sampler is ready', report.melody?.part?.samplerLoaded === true, String(report.melody?.part?.source))
  check('chord sampler is ready', report.chord?.voice?.samplerLoaded === true, String(report.chord?.voice?.source))
  check('texture sampler is ready', report.texture?.pad?.loaded === true, String(report.texture?.pad?.voice))
  check('drum kit has no missing slots', allLoaded(report.drum?.part?.samples), JSON.stringify(report.drum?.part?.samples ?? null))
  check('active generators have settled gain', ['drum', 'bass', 'melody', 'chord', 'texture'].every((role) => report[role]?.on && report[role]?.gain > 0.1), JSON.stringify(report))
  check(
    'auto lead and chord voices are distinct',
    report.melody?.part?.performerId !== report.chord?.voice?.performerId,
    `${report.melody?.part?.performerId} / ${report.chord?.voice?.performerId}`,
    'WARN',
  )

  let censusA = null
  let censusB = null
  if (hooks.census) {
    // Measure before feature/solo clicks so the audit does not create the
    // very churn it is supposed to detect.
    await page.evaluate(() => window.__nodeCensus.mark())
    await page.waitForTimeout(4000)
    censusA = await page.evaluate(() => window.__nodeCensus())
    await page.evaluate(() => window.__nodeCensus.mark())
    await page.waitForTimeout(4000)
    censusB = await page.evaluate(() => window.__nodeCensus())
    const growth = Object.fromEntries(Object.entries(censusB?.perType ?? {}).map(([type, next]) => [type, next.netLive - (censusA?.perType?.[type]?.netLive ?? next.netLive)]))
    const growing = Object.entries(growth).filter(([, delta]) => delta > 8)
    check('audio node census is stable across windows', growing.length === 0, JSON.stringify(growth), 'WARN')
  }

  const featureCases = [
    ['Band', 'none'],
    ['Melody', 'melody'],
    ['Chords', 'chord'],
    ['Pads / Keys', 'texture'],
    ['Melody + Chords', 'melody-chords'],
  ]
  for (const [label, expected] of featureCases) {
    await page.getByRole('button', { name: label, exact: true }).click().catch(() => {})
    await page.waitForTimeout(500)
    const state = await page.evaluate(() => window.__orgDebug?.() ?? null)
    const g = state?.gainReport ?? {}
    check(`feature button routes: ${label}`, state?.featuredPerformance === expected, `reported=${state?.featuredPerformance}`)
    if (expected === 'melody' || expected === 'melody-chords') {
      check(`${label} promotes melody`, g.melody?.part?.featured === true, JSON.stringify(g.melody?.part))
      check(`${label} pockets chord and texture`, g.chord?.voice?.leadPocketed === true && g.texture?.pad?.leadPocketed === true)
    } else if (expected === 'chord') {
      check('Chords feature pockets texture', g.texture?.pad?.leadPocketed === true)
    } else if (expected === 'texture') {
      check('Pads / Keys feature owns texture', g.texture?.pad?.featured === true)
    } else {
      check('Band restores normal voices', g.melody?.part?.featured === false && g.chord?.voice?.leadPocketed === false && g.texture?.pad?.featured === false)
    }
  }

  for (const role of ['drum', 'bass', 'melody', 'chord', 'texture']) {
    await page.evaluate((selected) => window.soloChannel?.(selected), role)
    await page.waitForTimeout(250)
    const solo = await page.evaluate(() => window.__orgDebug?.()?.solo ?? null)
    check(`solo routing: ${role}`, solo === role, `reported=${solo}`)
  }
  await page.evaluate(() => window.soloChannel?.(null))
  check('solo routing restores full band', await page.evaluate(() => window.__orgDebug?.()?.solo ?? null) === null)

  if (hooks.health) {
    const health = await page.evaluate(() => window.__audioHealth?.() ?? null)
    check('audio health has no real stalls', (health?.realStallCount ?? 0) === 0, JSON.stringify(health), 'WARN')
  }
  check('no page errors during audit', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '), 'WARN')

  const output = {
    label: LABEL,
    base: BASE,
    preset: PRESET_LABEL,
    startedAt,
    finishedAt: new Date().toISOString(),
    hooks,
    runtime,
    census: { first: censusA, second: censusB },
    pageErrors,
    findings,
  }
  const outputPath = path.join(OUT_DIR, `${LABEL}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  await browser.close()

  const failures = findings.filter((finding) => !finding.pass && finding.severity === 'FAIL')
  log(`report → ${outputPath}`)
  log(`checks=${findings.length} failures=${failures.length} warnings=${findings.filter((finding) => !finding.pass && finding.severity === 'WARN').length}`)
  if (failures.length) process.exitCode = 1
}

main().catch((error) => {
  console.error('[behavior-audit] FATAL', error)
  process.exitCode = 1
})
