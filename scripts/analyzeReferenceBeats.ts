import { spawnSync } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'
import { analyzePcm } from '../tools/audio-debug-mcp/src/analysis/pcmAnalyzer'

const root = process.argv[2] ?? 'audio/reference-beats'
const sampleRate = 22050

const files = readdirSync(root)
  .filter(file => /\.(mp3|m4a|wav|webm|aac)$/i.test(file))
  .sort()

const results = files.map(file => {
  const path = join(root, file)
  const ff = spawnSync('ffmpeg', [
    '-v', 'error',
    '-t', '90',
    '-i', path,
    '-f', 'f32le',
    '-ac', '1',
    '-ar', String(sampleRate),
    'pipe:1',
  ], { maxBuffer: 256 * 1024 * 1024 })

  if (ff.status !== 0) {
    return { file, error: ff.stderr.toString() }
  }

  const buf = ff.stdout
  const samples = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const report = analyzePcm(samples, sampleRate)

  return {
    file,
    durationAnalyzed: Number(report.durationSeconds.toFixed(1)),
    rmsDb: Number(report.rmsDb.toFixed(1)),
    peakDb: Number(report.peakDb.toFixed(1)),
    dynamicRangeDb: Number(report.dynamicRangeDb.toFixed(1)),
    clippingPercent: Number(report.clippingPercent.toFixed(4)),
    spectralCentroidHz: Math.round(report.spectralCentroidHz),
    bands: Object.fromEntries(
      Object.entries(report.bandEnergy)
        .map(([band, value]) => [band, Number((value * 100).toFixed(1))]),
    ),
    estimatedBpm: report.estimatedBpm,
    onsetCount: report.onsetCount,
    onsetTimingStdDevMs: Number(report.onsetTimingStdDevMs.toFixed(1)),
    summary: report.summary,
  }
})

console.log(JSON.stringify(results, null, 2))
