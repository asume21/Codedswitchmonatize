import { z } from 'zod'
import { spawn } from 'child_process'
import { waitForCapture } from '../client.js'
import { analyzePcm, type AudioAnalysisReport } from '../analysis/pcmAnalyzer.js'

export const diffAudioSchema = {
  capture_id_a: z.string().describe('First capture ID (the "before")'),
  capture_id_b: z.string().describe('Second capture ID (the "after")'),
}

async function decodeWebmToPcm(webmBuffer: Buffer): Promise<{ samples: Float32Array; sampleRate: number }> {
  const SAMPLE_RATE = 44100
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), 'pipe:1'])
    const chunks: Buffer[] = []
    ff.stdout.on('data', (c: Buffer) => chunks.push(c))
    ff.stderr.on('data', () => {})
    ff.stdout.on('end', () => {
      const combined = Buffer.concat(chunks)
      resolve({ samples: new Float32Array(combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength)), sampleRate: SAMPLE_RATE })
    })
    ff.on('error', reject)
    ff.stdin.write(webmBuffer)
    ff.stdin.end()
  })
}

function delta(a: number, b: number, label: string, unit = ''): string {
  if (!isFinite(a) || !isFinite(b)) return `${label}: ${a} → ${b}`
  const d = b - a
  const sign = d > 0 ? '+' : ''
  return `${label}: ${a.toFixed(1)}${unit} → ${b.toFixed(1)}${unit}  (${sign}${d.toFixed(1)}${unit})`
}

function flagged(changed: boolean, msg: string): string {
  return changed ? `⚠ ${msg}` : `  ${msg}`
}

export async function diffAudioHandler(args: { capture_id_a: string; capture_id_b: string }) {
  let bufA: Buffer, bufB: Buffer
  try {
    ;[bufA, bufB] = await Promise.all([
      waitForCapture(args.capture_id_a, 2000),
      waitForCapture(args.capture_id_b, 2000),
    ])
  } catch (err: unknown) {
    return { content: [{ type: 'text' as const, text: `Capture not found: ${err instanceof Error ? err.message : String(err)}` }] }
  }

  let rA: AudioAnalysisReport, rB: AudioAnalysisReport
  try {
    const [dA, dB] = await Promise.all([decodeWebmToPcm(bufA), decodeWebmToPcm(bufB)])
    rA = analyzePcm(dA.samples, dA.sampleRate)
    rB = analyzePcm(dB.samples, dB.sampleRate)
  } catch (err: unknown) {
    return { content: [{ type: 'text' as const, text: `Decode failed: ${err instanceof Error ? err.message : String(err)}` }] }
  }

  const rmsChange     = Math.abs(rB.rmsDb - rA.rmsDb)
  const centroidChange = Math.abs(rB.spectralCentroidHz - rA.spectralCentroidHz)
  const bpmChange     = rA.estimatedBpm && rB.estimatedBpm ? Math.abs(rB.estimatedBpm - rA.estimatedBpm) : null
  const jitterChange  = Math.abs(rB.onsetTimingStdDevMs - rA.onsetTimingStdDevMs)
  const newClipping   = !rA.hasClipping && rB.hasClipping
  const fixedClipping =  rA.hasClipping && !rB.hasClipping

  const lines = [
    `── Audio Diff: ${args.capture_id_a.slice(0, 8)}… → ${args.capture_id_b.slice(0, 8)}… ──`,
    ``,
    `── Loudness ──────────────────────────────────────────`,
    flagged(rmsChange > 3,     delta(rA.rmsDb,  rB.rmsDb,  'RMS', ' dBFS')),
    flagged(newClipping,       delta(rA.peakDb, rB.peakDb, 'Peak', ' dBFS')),
    newClipping   ? '⚠ CLIPPING INTRODUCED — gain staging regression' : '',
    fixedClipping ? '✓ Clipping resolved' : '',
    ``,
    `── Tone ──────────────────────────────────────────────`,
    flagged(centroidChange > 500, delta(rA.spectralCentroidHz, rB.spectralCentroidHz, 'Spectral centroid', ' Hz')),
    flagged(Math.abs(rB.dcOffset - rA.dcOffset) > 0.005, `DC offset: ${rA.dcOffset.toFixed(4)} → ${rB.dcOffset.toFixed(4)}`),
    ``,
    `── Rhythm ────────────────────────────────────────────`,
    bpmChange !== null
      ? flagged(bpmChange > 2, `BPM: ${rA.estimatedBpm} → ${rB.estimatedBpm}  (${bpmChange > 0 ? '+' : ''}${bpmChange?.toFixed(0)})`)
      : `  BPM: ${rA.estimatedBpm ?? 'n/a'} → ${rB.estimatedBpm ?? 'n/a'}`,
    flagged(jitterChange > 5, delta(rA.onsetTimingStdDevMs, rB.onsetTimingStdDevMs, 'Timing jitter', ' ms')),
    ``,
    `── Band Energy Change ────────────────────────────────`,
    ...((['sub', 'bass', 'lowMid', 'highMid', 'high'] as const).map(band => {
      const dPct = (rB.bandEnergy[band] - rA.bandEnergy[band]) * 100
      const sign = dPct > 0 ? '+' : ''
      return flagged(Math.abs(dPct) > 5, `${band.padEnd(8)}: ${sign}${dPct.toFixed(1)}%`)
    })),
    ``,
    `── Interpretation ────────────────────────────────────`,
    generateInterpretation(rA, rB, { rmsChange, centroidChange, jitterChange, newClipping, fixedClipping }),
  ].filter(l => l !== '').join('\n')

  return { content: [{ type: 'text' as const, text: lines }] }
}

function generateInterpretation(
  _rA: AudioAnalysisReport,
  _rB: AudioAnalysisReport,
  flags: {
    rmsChange: number
    centroidChange: number
    jitterChange: number
    newClipping: boolean
    fixedClipping: boolean
  },
): string {
  const parts: string[] = []
  if (flags.newClipping)          parts.push('A gain bug was introduced that causes clipping.')
  if (flags.fixedClipping)        parts.push('A clipping problem was fixed.')
  if (flags.rmsChange > 6)        parts.push(`Significant loudness change (${flags.rmsChange.toFixed(1)} dB) — check gain staging.`)
  if (flags.centroidChange > 800) parts.push('Tonal character changed noticeably — EQ or filter behaviour may have shifted.')
  if (flags.jitterChange > 10)    parts.push('Timing became more erratic — possible scheduler regression.')
  return parts.length ? parts.join(' ') : 'No significant changes detected between the two captures.'
}
