#!/usr/bin/env node
/**
 * Import VCSL (Versilian Community Sample Library, CC0) instruments that the
 * local libraries lack — Tenor Saxophone and a Steinway B grand piano — into the
 * app's playable-multisample format (audio/loops/<Id>/<Id>_<NOTE>.ogg).
 *
 * VCSL note names sit MID-filename: BrettTenor_Vib_Main_A#1_var2.wav,
 * JHPiano_Sus_Close_A#0_vl2_rr1.wav. We grab the "_<NOTE>_" token, keep ONE
 * sample per note (piano: prefer a mid velocity layer), ffmpeg → ogg.
 *
 * Run:  node scripts/import-vcsl.mjs
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const SRC = 'D:/wav/VCSL_dl'
const DEST_ROOT = path.resolve(process.cwd(), 'audio/loops')

const MAP = [
  {
    id: 'VCSL_TenorSax',
    dir: 'Aerophones/Reed Aerophones/Tenor Saxophone/Vibrato',
    prefer: [],                       // any first sample per note
  },
  {
    id: 'VCSL_Piano',
    dir: 'Chordophones/Zithers/Grand Piano, Steinway B/Sus',
    prefer: ['_vl3_', '_vl4_', '_vl2_'],   // one medium-loud velocity layer per note
  },
]

// note token as "_<NOTE>_": letter, optional accidental, octave (single digit).
const NOTE_MID = /_([a-gA-G])(#|b)?(-?\d)_/

function normNote(letter, acc, oct) {
  return `${letter.toUpperCase()}${acc ?? ''}${oct}`
}

let total = 0
for (const { id, dir, prefer } of MAP) {
  const srcDir = path.join(SRC, dir)
  if (!existsSync(srcDir)) { console.warn(`SKIP ${id}: missing ${srcDir}`); continue }
  const outDir = path.join(DEST_ROOT, id)
  mkdirSync(outDir, { recursive: true })

  // Group candidate files by note, then pick the preferred velocity layer.
  const byNote = new Map()
  for (const f of readdirSync(srcDir)) {
    if (!f.toLowerCase().endsWith('.wav')) continue
    const m = NOTE_MID.exec(f)
    if (!m) continue
    const note = normNote(m[1], m[2], m[3])
    if (!byNote.has(note)) byNote.set(note, [])
    byNote.get(note).push(f)
  }

  let n = 0
  for (const [note, files] of byNote) {
    let chosen = files[0]
    for (const p of prefer) {
      const hit = files.find((f) => f.includes(p))
      if (hit) { chosen = hit; break }
    }
    const out = path.join(outDir, `${id}_${note}.ogg`)
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(srcDir, chosen),
      '-c:a', 'libvorbis', '-q:a', '5', out], { stdio: 'inherit' })
    if (r.status === 0) n++
    else console.error(`  ffmpeg failed: ${chosen}`)
  }
  console.log(`${id.padEnd(16)} ${String(n).padStart(2)} notes  (from ${dir})`)
  total += n
}
console.log(`\nDone. ${total} samples → ${DEST_ROOT}`)
