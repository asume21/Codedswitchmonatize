#!/usr/bin/env node
/**
 * Import Sonatina Symphonic Orchestra (CC0) sustained samples into the app's
 * playable-multisample format.
 *
 * Source: D:\wav\SonatinaOrchestra  (note-mapped WAVs, e.g. 1st-violins-sus-a#3.wav)
 * Output: audio/loops/SSO_<Id>/SSO_<Id>_<NOTE>.ogg   (libvorbis q5, stereo)
 *
 * The note is the trailing "-<note>.wav" token. We convert WAV→ogg with ffmpeg so
 * the existing scanner (server/services/multisampleInstruments.ts) picks them up at
 * /api/loops/instruments — the SAME path the real e-pianos already use. No scanner
 * change needed: basename "SSO_Violins1_A#3" splits to id "SSO_Violins1" + note "A#3".
 *
 * Run:  node scripts/import-sso-instruments.mjs
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const SRC = 'D:/wav/SonatinaOrchestra/master/sso-master/Sonatina Symphonic Orchestra/Samples'
const DEST_ROOT = path.resolve(process.cwd(), 'audio/loops')

// id → { folder, artic }. artic='sus' filters to the sustained articulation in
// folders that have multiple (string sections); null = take every note file
// (solo winds/brass/harp folders that have only one articulation).
const MAP = [
  { id: 'SSO_Violins1', folder: '1st Violins',    artic: 'sus' },
  { id: 'SSO_Violins2', folder: '2nd Violins',    artic: 'sus' },
  { id: 'SSO_Violas',   folder: 'Violas',         artic: 'sus' },
  { id: 'SSO_Cello',    folder: 'Celli',          artic: 'sus' },  // "Cello" so classifyFamily→strings
  { id: 'SSO_Basses',   folder: 'Basses',         artic: 'sus' },
  { id: 'SSO_Flute',    folder: 'Flute',          artic: null  },
  { id: 'SSO_Oboe',     folder: 'Oboe',           artic: null  },
  { id: 'SSO_Clarinet', folder: 'Clarinet',       artic: null  },
  { id: 'SSO_Bassoon',  folder: 'Bassoon',        artic: null  },
  { id: 'SSO_Trumpet',  folder: 'Trumpet',        artic: null  },
  { id: 'SSO_Horn',     folder: 'Horn',           artic: null  },
  { id: 'SSO_Trombone', folder: 'Tenor Trombone', artic: null  },
  { id: 'SSO_Tuba',     folder: 'Tuba',           artic: 'sus' },
  { id: 'SSO_Harp',     folder: 'Harp',           artic: null  },
]

// Capture the trailing note token: "...-a#3.wav" → letter / accidental / octave.
const NOTE_AT_END = /-([a-gA-G])(#|b)?(-?\d)\.wav$/

function normNote(letter, acc, oct) {
  return `${letter.toUpperCase()}${acc ?? ''}${oct}`
}

let total = 0
for (const { id, folder, artic } of MAP) {
  const dir = path.join(SRC, folder)
  if (!existsSync(dir)) { console.warn(`SKIP ${id}: missing ${dir}`); continue }
  const outDir = path.join(DEST_ROOT, id)
  mkdirSync(outDir, { recursive: true })

  const files = readdirSync(dir).filter(f => {
    if (!f.toLowerCase().endsWith('.wav')) return false
    if (artic && !f.toLowerCase().includes(`-${artic}-`)) return false
    return NOTE_AT_END.test(f)
  })

  let n = 0
  const seen = new Set()
  for (const f of files) {
    const m = NOTE_AT_END.exec(f)
    if (!m) continue
    const note = normNote(m[1], m[2], m[3])
    if (seen.has(note)) continue          // first sample per note wins (skip rr dupes)
    seen.add(note)
    const out = path.join(outDir, `${id}_${note}.ogg`)
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, f),
      '-c:a', 'libvorbis', '-q:a', '5', out], { stdio: 'inherit' })
    if (r.status === 0) n++
    else console.error(`  ffmpeg failed: ${f}`)
  }
  console.log(`${id.padEnd(14)} ${String(n).padStart(2)} notes  (from ${folder})`)
  total += n
}
console.log(`\nDone. ${total} samples → ${DEST_ROOT}`)
