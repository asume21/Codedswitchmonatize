import { loadAudio, decodeToPcm, AudioSourceError, audioSourceFields, type AudioSourceArgs } from '../audioSource.js'
import { analyzePcm } from '../analysis/pcmAnalyzer.js'

export const analyzeAudioSchema = audioSourceFields

export async function analyzeAudioHandler(args: AudioSourceArgs) {
  let samples: Float32Array
  let sampleRate: number
  let label: string
  try {
    const audio = await loadAudio(args)
    label = audio.label
    ;({ samples, sampleRate } = await decodeToPcm(audio.bytes))
  } catch (err: unknown) {
    const msg = err instanceof AudioSourceError ? err.message : `Could not decode audio: ${err instanceof Error ? err.message : String(err)}`
    return { content: [{ type: 'text' as const, text: msg }] }
  }

  const report = analyzePcm(samples, sampleRate)

  const text = [
    `── Audio Analysis Report: ${label} ──`,
    `Duration:          ${report.durationSeconds.toFixed(2)}s`,
    ``,
    `── Loudness ─────────────────────────────────────────`,
    `RMS:               ${report.rmsDb.toFixed(1)} dBFS`,
    `Peak:              ${report.peakDb.toFixed(1)} dBFS`,
    `Dynamic range:     ${report.dynamicRangeDb.toFixed(1)} dB`,
    `Crest factor:      ${report.crestFactor.toFixed(2)}`,
    `Clipping:          ${report.hasClipping ? `YES — ${report.clippingPercent.toFixed(3)}% of samples` : 'none'}`,
    ``,
    `── Tone ──────────────────────────────────────────────`,
    `Spectral centroid: ${report.spectralCentroidHz.toFixed(0)} Hz`,
    `DC offset:         ${report.dcOffset.toFixed(5)} ${report.hasDcOffset ? '⚠ elevated' : '(ok)'}`,
    ``,
    `── Frequency Bands ───────────────────────────────────`,
    `Sub  (20-80 Hz):   ${(report.bandEnergy.sub     * 100).toFixed(1)}%`,
    `Bass (80-250 Hz):  ${(report.bandEnergy.bass    * 100).toFixed(1)}%`,
    `Mid  (250-2k Hz):  ${(report.bandEnergy.lowMid  * 100).toFixed(1)}%`,
    `Hi-mid (2-6k Hz):  ${(report.bandEnergy.highMid * 100).toFixed(1)}%`,
    `High (6k+ Hz):     ${(report.bandEnergy.high    * 100).toFixed(1)}%`,
    ``,
    `── Rhythm ────────────────────────────────────────────`,
    `Estimated BPM:     ${report.estimatedBpm ?? 'not detected'}`,
    `Tempo candidates:  ${report.tempoCandidates.map(c => `${c.bpm} (${c.strength})`).join(', ') || 'n/a'}`,
    `Onset count:       ${report.onsetCount}`,
    `Timing jitter:     ${report.onsetTimingStdDevMs.toFixed(1)} ms std dev`,
    ``,
    `── Harmony ───────────────────────────────────────────`,
    report.key
      ? `Key:               ${report.key.name}  (r=${report.key.correlation}, margin ${report.key.margin}; next: ${report.key.alternatives.map(a => `${a.name} ${a.correlation}`).join(', ')})`
      : `Key:               not detected`,
    ``,
    `── Summary ───────────────────────────────────────────`,
    report.summary,
  ].join('\n')

  return {
    content: [{ type: 'text' as const, text }],
  }
}
