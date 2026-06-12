#!/usr/bin/env node
/**
 * Convert the Soulful Keys note-sample WAVs into committable OGGs so PRODUCTION
 * gets the real e-pianos/FM pianos/organs (the WAV pack is ~770MB and gitignored;
 * prod was falling back to GM/synth chords without these).
 *
 * Source: any SK_<Id>_<NOTE>.wav under audio/loops (wherever the pack puts them)
 * Output: audio/loops/SK_<Id>/SK_<Id>_<NOTE>.ogg   (libvorbis q5, stereo)
 *
 * The scanner (server/services/multisampleInstruments.ts) prefers ogg over wav
 * for the same note, so locally nothing changes; in prod only the oggs exist.
 * Same convention as scripts/import-sso-instruments.mjs.
 *
 * Run:  node scripts/import-sk-keys.mjs
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const LOOPS = path.resolve(process.cwd(), 'audio/loops')

// Trailing note token, matching the scanner's NOTE_RE semantics: "..._C3.wav",
// "..._A#-1.wav". The note must be the LAST underscore token (chord hits like
// SK_ElPiano01_Chord_Bmin7.wav don't match and are correctly skipped).
const NOTE_AT_END = /_([A-Ga-g])(#|b)?(-?\d)\.wav$/

function walk(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('._') || e.name === '__MACOSX') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, acc)
    else if (e.isFile()) acc.push(full)
  }
}

const files = []
walk(LOOPS, files)

// Group by instrument id, first sample per note wins (deterministic: sorted).
const byId = new Map()
for (const full of files.sort()) {
  const base = path.basename(full)
  if (!base.startsWith('SK_')) continue
  const m = NOTE_AT_END.exec(base)
  if (!m) continue
  const note = `${m[1].toUpperCase()}${m[2] ?? ''}${m[3]}`
  const id = base.slice(0, base.lastIndexOf('_'))
  const map = byId.get(id) ?? new Map()
  if (!map.has(note)) map.set(note, full)
  byId.set(id, map)
}

let total = 0
for (const [id, notes] of byId) {
  if (notes.size < 4) { console.warn(`SKIP ${id}: only ${notes.size} notes`); continue }
  const outDir = path.join(LOOPS, id)
  mkdirSync(outDir, { recursive: true })
  let n = 0
  for (const [note, src] of notes) {
    const out = path.join(outDir, `${id}_${note}.ogg`)
    if (existsSync(out)) { n++; continue }    // resumable
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src,
      '-c:a', 'libvorbis', '-q:a', '5', out], { stdio: 'inherit' })
    if (r.status === 0) n++
    else console.error(`  ffmpeg failed: ${src}`)
  }
  console.log(`${id.padEnd(16)} ${String(n).padStart(2)} notes`)
  total += n
}
console.log(`\nDone. ${total} samples → ${LOOPS}\\SK_*`)
