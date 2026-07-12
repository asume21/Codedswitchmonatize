// Detect dropouts (runs of digital silence) and clicks (sample-to-sample jumps)
// in a captured WAV. Crackle/cutout is a BUFFER UNDERRUN, and it leaves both.
import fs from 'node:fs'

function readWav(p) {
  const b = fs.readFileSync(p)
  let off = 12, fmt = null, dataOff = 0, dataLen = 0
  while (off < b.length - 8) {
    const id = b.toString('ascii', off, off + 4)
    const sz = b.readUInt32LE(off + 4)
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) }
    if (id === 'data') { dataOff = off + 8; dataLen = sz; break }
    off += 8 + sz + (sz % 2)
  }
  const n = Math.floor(dataLen / 2 / fmt.ch)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(dataOff + i * 2 * fmt.ch) / 32768
  return { x, rate: fmt.rate }
}

for (const path of process.argv.slice(2)) {
  const { x, rate } = readWav(path)
  // Dropout: >=3ms of exact digital silence inside otherwise-live audio.
  const minRun = Math.floor(rate * 0.003)
  let run = 0, dropouts = 0, dropSamples = 0
  // Click: |x[i]-x[i-1]| jump larger than a plausible waveform slope.
  let clicks = 0, maxJump = 0
  for (let i = 1; i < x.length; i++) {
    if (x[i] === 0) { run++ } else { if (run >= minRun) { dropouts++; dropSamples += run } run = 0 }
    const d = Math.abs(x[i] - x[i - 1])
    if (d > maxJump) maxJump = d
    if (d > 0.35) clicks++
  }
  if (run >= minRun) { dropouts++; dropSamples += run }
  const secs = (x.length / rate).toFixed(1)
  console.log(
    path.split(/[\/]/).slice(-2).join('/').padEnd(34),
    `${secs}s  dropouts=${String(dropouts).padStart(3)}  silent=${(dropSamples / rate * 1000).toFixed(0)}ms  clicks=${String(clicks).padStart(5)}  maxJump=${maxJump.toFixed(2)}`,
  )
}
