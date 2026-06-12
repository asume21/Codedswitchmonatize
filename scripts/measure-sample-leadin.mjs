// Measure leading silence (ms to first transient) of drum WAVs.
// A drum sample with a long/inconsistent lead-in makes every scheduled hit
// land late by that amount — the groove smears no matter how exact the
// Tone.js scheduling is. Usage: node scripts/measure-sample-leadin.mjs <dir> [dir2...]
import fs from 'fs'
import path from 'path'

const THRESHOLD = 0.05 // ~-26 dBFS — first sample above this counts as the transient

function wavLeadInMs(filePath) {
  const buf = fs.readFileSync(filePath)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null
  let offset = 12
  let sampleRate = 0, channels = 0, bits = 0, dataOffset = -1, dataBytes = 0, fmt = 1
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      fmt = buf.readUInt16LE(offset + 8)
      channels = buf.readUInt16LE(offset + 10)
      sampleRate = buf.readUInt32LE(offset + 12)
      bits = buf.readUInt16LE(offset + 22)
    } else if (id === 'data') {
      dataOffset = offset + 8
      dataBytes = size
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (dataOffset < 0 || !sampleRate || !channels) return null
  const bytesPerSample = bits / 8
  const frameBytes = channels * bytesPerSample
  const frames = Math.floor(dataBytes / frameBytes)
  const readSample = (frame) => {
    const base = dataOffset + frame * frameBytes
    if (base + bytesPerSample > buf.length) return 0
    if (fmt === 3 && bits === 32) return Math.abs(buf.readFloatLE(base))
    if (bits === 16) return Math.abs(buf.readInt16LE(base) / 32768)
    if (bits === 24) {
      const b0 = buf[base], b1 = buf[base + 1], b2 = buf[base + 2]
      let v = (b2 << 16) | (b1 << 8) | b0
      if (v & 0x800000) v -= 0x1000000
      return Math.abs(v / 8388608)
    }
    if (bits === 32) return Math.abs(buf.readInt32LE(base) / 2147483648)
    return 0
  }
  for (let f = 0; f < frames; f++) {
    if (readSample(f) >= THRESHOLD) return (f / sampleRate) * 1000
  }
  return null // never crossed threshold
}

const dirs = process.argv.slice(2)
const rows = []
for (const dir of dirs) {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.wav$/i.test(e.name)) {
        try {
          const ms = wavLeadInMs(full)
          rows.push({ file: path.relative(dir, full), leadInMs: ms === null ? 'silent/quiet' : ms.toFixed(1) })
        } catch (err) { rows.push({ file: e.name, leadInMs: 'err:' + err.message }) }
      }
    }
  }
  walk(dir)
}
rows.sort((a, b) => (parseFloat(b.leadInMs) || 0) - (parseFloat(a.leadInMs) || 0))
for (const r of rows) console.log(String(r.leadInMs).padStart(12), ' ', r.file)
console.log(`\n${rows.length} files. Lead-in > 5ms smears the groove; > 15ms is audibly late.`)
