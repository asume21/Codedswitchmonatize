#!/usr/bin/env node
/**
 * Import VSCO2 Community Edition string sections (CC0) as a blended string pad
 * instrument for the Organism's chord/texture roles.
 *
 * Source:
 *   Violin Section – D:\wav\VSCO2\master\VSCO-2-CE-master\Strings\Violin Section\susVib\
 *   Viola Section  – D:\wav\VSCO2\master\VSCO-2-CE-master\Strings\Viola Section\susvib\
 *
 * Output:  audio/loops/VSCO2_StringSection/VSCO2_StringSection_<NOTE>.ogg
 *
 * Strategy:
 *   - Use violin (v1 = soft velocity) as the primary source — bright, pad-friendly
 *   - Use viola v1 to fill lower notes absent in the violin set (C2, D2, E2, F3)
 *   - Skip v2 (loud) velocity layers — pads want the softer, more legato character
 *   - 19+ combined unique notes across C2–D5 gives Tone.Sampler <3 semitone stretch
 *
 * Run:  node scripts/import-vsco2-strings.mjs
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const VSCO2_ROOT = 'D:/wav/VSCO2/master/VSCO-2-CE-master/Strings'
const VIOLIN_DIR = path.join(VSCO2_ROOT, 'Violin Section', 'susVib')
const VIOLA_DIR  = path.join(VSCO2_ROOT, 'Viola Section',  'susvib')
const DEST_ID    = 'VSCO2_StringSection'
const DEST_ROOT  = path.resolve(process.cwd(), 'audio/loops', DEST_ID)

// Regex: match the NOTE token before the _v velocity suffix.
// Violin: VlnEns_susVib_A2_v1.wav   → captures "A2"
// Viola:  ViolaEns_susvib_A3_v1_1.wav → captures "A3"
const NOTE_RE = /_([A-G]#?\d)_v1/i

function extractNote(filename) {
  const m = filename.match(NOTE_RE)
  return m ? m[1] : null
}

function convert(srcAbs, destAbs) {
  const r = spawnSync('ffmpeg', [
    '-y',
    '-i', srcAbs,
    '-c:a', 'libvorbis',
    '-q:a', '5',
    '-ac', '2',   // ensure stereo
    destAbs,
  ], { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(`  ERROR converting ${path.basename(srcAbs)}:\n${r.stderr}`)
    return false
  }
  return true
}

mkdirSync(DEST_ROOT, { recursive: true })

// note → { file, src } — collect both sections, violin wins on overlap
const noteMap = new Map()

// Viola first (lower priority)
if (existsSync(VIOLA_DIR)) {
  for (const f of readdirSync(VIOLA_DIR)) {
    if (!f.toLowerCase().endsWith('.wav')) continue
    const note = extractNote(f)
    if (!note) continue
    noteMap.set(note, { file: f, dir: VIOLA_DIR, section: 'viola' })
  }
} else {
  console.warn(`SKIP viola: ${VIOLA_DIR} not found`)
}

// Violin overwrites (higher priority — brighter, pad-friendly)
if (existsSync(VIOLIN_DIR)) {
  for (const f of readdirSync(VIOLIN_DIR)) {
    if (!f.toLowerCase().endsWith('.wav')) continue
    const note = extractNote(f)
    if (!note) continue
    noteMap.set(note, { file: f, dir: VIOLIN_DIR, section: 'violin' })
  }
} else {
  console.warn(`SKIP violin: ${VIOLIN_DIR} not found`)
}

if (noteMap.size === 0) {
  console.error('No notes found — check source paths above.')
  process.exit(1)
}

// Sort for readable output
const sortedNotes = [...noteMap.keys()].sort((a, b) => {
  // sort by octave then letter: C2 < D2 < ... < B2 < C3 ...
  const parse = n => ({ oct: parseInt(n.slice(-1)), pc: n.slice(0, -1) })
  const pa = parse(a), pb = parse(b)
  return pa.oct !== pb.oct ? pa.oct - pb.oct : pa.pc.localeCompare(pb.pc)
})

console.log(`Found ${noteMap.size} unique notes — converting to ${DEST_ROOT}\n`)

let ok = 0
for (const note of sortedNotes) {
  const { file, dir, section } = noteMap.get(note)
  const src  = path.join(dir, file)
  const dest = path.join(DEST_ROOT, `${DEST_ID}_${note}.ogg`)
  process.stdout.write(`  [${section.padEnd(6)}] ${note.padEnd(4)} ${file} → ${path.basename(dest)}  `)
  if (convert(src, dest)) { console.log('✓'); ok++ }
}

console.log(`\nDone: ${ok}/${noteMap.size} notes imported as ${DEST_ID}`)
console.log(`\nNext: restart the dev server so /api/loops/instruments picks up the new instrument.`)
