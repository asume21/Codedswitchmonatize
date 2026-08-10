// Organism Double-Finder
// ─────────────────────────────────────────────────────────────────────────
// The repo's #1 problem is DUPLICATE/competing systems — "the doubles that
// haunt us". The 2026-06-17 master kill-list catalogued the STRUCTURAL ones
// (two mixers, two engines, two track stores). It would not have caught any of
// the three found by ear on 2026-08-09, because those were a different class:
// not two components, but two CODE PATHS to the same audible output.
//
// Those three shared searchable fingerprints, and this script hunts them:
//
//   A. DEAD CONTROLS — a setter with zero callers. `setDuetEnabled` had none,
//      so `duetEnabled = true` could never be switched off and an instrumental
//      duet played a second melody under every take, forever.
//
//   B. ALWAYS-ON GATES — a boolean field defaulting to `true` whose only setter
//      is dead. Same bug, stated as state instead of as API.
//
//   C. OUT-OF-PART TRIGGERS — a note fired directly at a voice rather than
//      scheduled through that generator's Tone.Part. triggerAnswerLick's own
//      docstring says "OUTSIDE the looping phrase Part". Every one of these is
//      a second voice on an existing output and must be gated by something a
//      user can actually reach.
//
//   D. COUPLED KILL-SWITCHES — a volume/level setter that also flips an enable
//      flag, so "quiet" silently means "off". setTextureVolume(0) called
//      setTextureEnabled(false) and the solo buttons turned the pad off for good.
//
// None of these are proof of a bug — they are the places bugs of this shape
// live. Read the output as a worklist, not a verdict.
//
// Usage: node scripts/find-organism-doubles.mjs [--json]

import fs from 'node:fs'
import path from 'node:path'

const ROOTS = [
  'client/src/organism',
  'client/src/features/organism',
]
// Call sites can live anywhere in the client, so callers are searched app-wide.
const CALLER_ROOT = 'client/src'
const JSON_OUT = process.argv.includes('--json')

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) { walk(p, out); continue }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.test\.|__tests__|__mocks__/.test(p)) continue
    out.push(p)
  }
  return out
}

const organismFiles = ROOTS.flatMap((r) => walk(r))
const allFiles = walk(CALLER_ROOT)
const source = new Map(allFiles.map((f) => [f, fs.readFileSync(f, 'utf8')]))
const rel = (p) => p.replace(/\\/g, '/')

// ── A. Dead controls ──────────────────────────────────────────────────
// A method defined in the organism whose name reads like a control, but which
// nothing outside its own file ever calls.
const CONTROL = /^\s{2}(?:public\s+)?(set[A-Z]\w*|enable[A-Z]\w*|disable[A-Z]\w*|toggle[A-Z]\w*)\s*\(/
const deadControls = []
for (const file of organismFiles) {
  const text = source.get(file) ?? ''
  text.split('\n').forEach((line, i) => {
    const m = line.match(CONTROL)
    if (!m) return
    const name = m[1]
    let callers = 0
    const callRe = new RegExp(`[.\\s(]${name}\\s*\\(`)
    for (const [f, t] of source) {
      if (f === file) {
        // Same-file callers COUNT. Skipping them produced a false positive on
        // BassGenerator.setSubLevel, which IS called internally
        // (`this.setSubLevel(use808 ? 0 : 0.5)`) and is not dead at all.
        // Exclude only the definition lines themselves.
        const body = t.split('\n').filter((l) => !CONTROL.test(l)).join('\n')
        if (callRe.test(body)) callers++
        continue
      }
      if (callRe.test(t)) callers++
    }
    if (callers === 0) deadControls.push({ file: rel(file), line: i + 1, name })
  })
}

// ── B. Always-on gates ────────────────────────────────────────────────
// A boolean field defaulting to true. Cross-referenced against dead controls:
// default-true + no reachable setter = permanently on, invisibly.
const BOOL_TRUE = /^\s{2}(?:private|public|protected)?\s*(\w+)\s*:\s*boolean\s*=\s*true/
const deadNames = new Set(deadControls.map((d) => d.name.toLowerCase()))
const alwaysOn = []
for (const file of organismFiles) {
  const text = source.get(file) ?? ''
  text.split('\n').forEach((line, i) => {
    const m = line.match(BOOL_TRUE)
    if (!m) return
    const field = m[1]
    const setter = 'set' + field[0].toUpperCase() + field.slice(1)
    const hasDeadSetter = deadNames.has(setter.toLowerCase())
    // Is the field read as a gate anywhere (`if (!this.field)`)?
    const gates = new RegExp(`if\\s*\\(\\s*!this\\.${field}\\b`).test(text)
    if (gates) alwaysOn.push({ file: rel(file), line: i + 1, field, setter, setterIsDead: hasDeadSetter })
  })
}

// ── C. Out-of-Part triggers ───────────────────────────────────────────
// Every note-emitting call, tagged with the enclosing method, so a trigger that
// is not the generator's Part callback stands out.
const TRIGGER = /\.(triggerAttackRelease|triggerAttack)\s*\(/
const METHOD = /^\s{2}(?:private\s+|public\s+|protected\s+)?(?:async\s+)?(\w+)\s*\(/
const triggers = []
for (const file of organismFiles) {
  const text = source.get(file) ?? ''
  const lines = text.split('\n')
  let method = '(top level)'
  lines.forEach((line, i) => {
    const mm = line.match(METHOD)
    if (mm && !/^\s*(if|for|while|switch|catch|return)\b/.test(line)) method = mm[1]
    if (!TRIGGER.test(line)) return
    // Look back for the Part callback that would normally own this trigger.
    const back = lines.slice(Math.max(0, i - 40), i).join('\n')
    const insidePart = /new Tone\.Part\(/.test(back)
    triggers.push({ file: rel(file), line: i + 1, method, insidePart })
  })
}

// ── D. Coupled kill-switches ──────────────────────────────────────────
// A level/volume setter that also flips an enable flag: "quiet" becomes "off".
const coupled = []
for (const file of allFiles) {
  const text = source.get(file) ?? ''
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    const m = line.match(/(set\w*(?:Volume|Level|Gain)\w*)\s*[:=]?\s*\(/)
    if (!m) return
    const window = lines.slice(i, i + 8).join('\n')
    const kill = window.match(/set\w*Enabled\s*\(\s*\w+\s*>\s*0\s*\)/)
    if (kill) coupled.push({ file: rel(file), line: i + 1, setter: m[1], couples: kill[0] })
  })
}

const report = { deadControls, alwaysOn, triggers, coupled }

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const H = (s) => `\n${'═'.repeat(72)}\n${s}\n${'═'.repeat(72)}`

  console.log(H('A. DEAD CONTROLS — defined in the organism, called by nobody'))
  console.log('   A control nothing can reach cannot be turned off. This is how')
  console.log('   `duetEnabled = true` played a second melody under every take.\n')
  if (!deadControls.length) console.log('   none')
  for (const d of deadControls) console.log(`   ${d.file}:${d.line}  ${d.name}()`)

  console.log(H('B. ALWAYS-ON GATES — boolean defaults to true AND gates behaviour'))
  console.log('   Flagged ⚠ when its setter is also dead: permanently on, invisibly.\n')
  if (!alwaysOn.length) console.log('   none')
  for (const a of alwaysOn) {
    console.log(`   ${a.setterIsDead ? '⚠ ' : '  '}${a.file}:${a.line}  ${a.field} (setter ${a.setter}${a.setterIsDead ? ' is DEAD' : ' exists'})`)
  }

  const ghosts = triggers.filter((t) => !t.insidePart)
  console.log(H('C. OUT-OF-PART TRIGGERS — notes fired outside a Tone.Part'))
  console.log('   Each is a second voice on an existing output. Legitimate only if')
  console.log('   gated by something the user can actually reach.\n')
  if (!ghosts.length) console.log('   none')
  for (const t of ghosts) console.log(`   ${t.file}:${t.line}  in ${t.method}()`)
  console.log(`\n   (${triggers.length - ghosts.length} more are inside a Part — those are fine)`)

  console.log(H('D. COUPLED KILL-SWITCHES — a level setter that also disables'))
  console.log('   "Quiet" silently means "off". This is what let the solo buttons')
  console.log('   switch the pad off permanently.\n')
  if (!coupled.length) console.log('   none')
  for (const c of coupled) console.log(`   ${c.file}:${c.line}  ${c.setter} → ${c.couples}`)

  console.log(`\n${'─'.repeat(72)}`)
  console.log(`dead controls ${deadControls.length} · always-on gates ${alwaysOn.filter(a=>a.setterIsDead).length}/${alwaysOn.length} · out-of-Part triggers ${ghosts.length} · coupled kill-switches ${coupled.length}`)
  console.log('These are PLACES bugs of this shape live, not proof of bugs. Read as a worklist.')
}
