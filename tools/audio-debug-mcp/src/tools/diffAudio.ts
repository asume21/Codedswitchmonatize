import { z } from 'zod'
import { loadAudio, decodeToPcm, AudioSourceError } from '../audioSource.js'
import { analyzePcm, type AudioAnalysisReport } from '../analysis/pcmAnalyzer.js'

export const diffAudioSchema = {
  capture_id_a: z.string().optional().describe('First capture ID (the "before")'),
  file_a:       z.string().optional().describe('…or an absolute path to the first audio file'),
  capture_id_b: z.string().optional().describe('Second capture ID (the "after")'),
  file_b:       z.string().optional().describe('…or an absolute path to the second audio file'),
}

type DiffArgs = { capture_id_a?: string; file_a?: string; capture_id_b?: string; file_b?: string }

function delta(a: number, b: number, label: string, unit = ''): string {
  if (!isFinite(a) || !isFinite(b)) return `${label}: ${a} → ${b}`
  const d = b - a
  const sign = d > 0 ? '+' : ''
  return `${label}: ${a.toFixed(1)}${unit} → ${b.toFixed(1)}${unit}  (${sign}${d.toFixed(1)}${unit})`
}

function flagged(changed: boolean, msg: string): string {
  return changed ? `⚠ ${msg}` : `  ${msg}`
}

export async function diffAudioHandler(args: DiffArgs) {
  let rA: AudioAnalysisReport, rB: AudioAnalysisReport, labelA: string, labelB: string
  try {
    const [a, b] = await Promise.all([
      loadAudio({ capture_id: args.capture_id_a, file: args.file_a }),
      loadAudio({ capture_id: args.capture_id_b, file: args.file_b }),
    ])
    const [dA, dB] = await Promise.all([decodeToPcm(a.bytes), decodeToPcm(b.bytes)])
    rA = analyzePcm(dA.samples, dA.sampleRate)
    rB = analyzePcm(dB.samples, dB.sampleRate)
    labelA = a.label
    labelB = b.label
  } catch (err: unknown) {
    const msg = err instanceof AudioSourceError ? err.message : `Decode failed: ${err instanceof Error ? err.message : String(err)}`
    return { content: [{ type: 'text' as const, text: msg }] }
  }

  const rmsChange     = Math.abs(rB.rmsDb - rA.rmsDb)
  const centroidChange = Math.abs(rB.spectralCentroidHz - rA.spectralCentroidHz)
  const bpmChange     = rA.estimatedBpm && rB.estimatedBpm ? Math.abs(rB.estimatedBpm - rA.estimatedBpm) : null
  const jitterChange  = Math.abs(rB.onsetTimingStdDevMs - rA.onsetTimingStdDevMs)
  const newClipping   = !rA.hasClipping && rB.hasClipping
  const fixedClipping =  rA.hasClipping && !rB.hasClipping

  const lines = [
    `── Audio Diff: ${labelA} → ${labelB} ──`,
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
    flagged((rA.key?.name ?? null) !== (rB.key?.name ?? null), `Key: ${rA.key?.name ?? 'n/a'} → ${rB.key?.name ?? 'n/a'}`),
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
  return parts.length ? parts.join(' ') : 'No significant changes detected between the two clips.'
}
