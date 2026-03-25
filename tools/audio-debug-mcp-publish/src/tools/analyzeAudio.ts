import { z } from 'zod'
import { spawn } from 'child_process'
import { waitForCapture } from '../client.js'
import { analyzePcm } from '../analysis/pcmAnalyzer.js'

export const analyzeAudioSchema = {
  capture_id: z.string().describe('The capture ID returned by capture_audio'),
}

async function decodeWebmToPcm(webmBuffer: Buffer): Promise<{ samples: Float32Array; sampleRate: number }> {
  const SAMPLE_RATE = 44100

  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-i',  'pipe:0',
      '-f',  'f32le',
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      'pipe:1',
    ])

    const chunks: Buffer[] = []
    ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    ff.stderr.on('data', () => {}) // suppress ffmpeg console noise

    ff.stdout.on('end', () => {
      const combined = Buffer.concat(chunks)
      // Float32Array requires aligned 4-byte boundary
      const aligned = combined.buffer.slice(
        combined.byteOffset,
        combined.byteOffset + combined.byteLength,
      )
      resolve({
        samples:    new Float32Array(aligned),
        sampleRate: SAMPLE_RATE,
      })
    })

    ff.on('error', (err) => reject(new Error(`ffmpeg not found or failed: ${err.message}. Install ffmpeg and ensure it is on your PATH.`)))
    ff.on('close', (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })

    ff.stdin.write(webmBuffer)
    ff.stdin.end()
  })
}

export async function analyzeAudioHandler(args: { capture_id: string }) {
  let buffer: Buffer
  try {
    buffer = await waitForCapture(args.capture_id, 2000)
  } catch {
    return {
      content: [{
        type: 'text' as const,
        text: `Capture "${args.capture_id}" not found. Run capture_audio first.`,
      }],
    }
  }

  let samples: Float32Array
  let sampleRate: number

  try {
    const decoded = await decodeWebmToPcm(buffer)
    samples = decoded.samples
    sampleRate = decoded.sampleRate
  } catch (err: unknown) {
    return {
      content: [{
        type: 'text' as const,
        text: `Could not decode audio: ${err instanceof Error ? err.message : String(err)}`,
      }],
    }
  }

  const report = analyzePcm(samples, sampleRate)

  const text = [
    `── Audio Analysis Report ──────────────────────────────`,
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
    `Onset count:       ${report.onsetCount}`,
    `Timing jitter:     ${report.onsetTimingStdDevMs.toFixed(1)} ms std dev`,
    ``,
    `── Summary ───────────────────────────────────────────`,
    report.summary,
  ].join('\n')

  return {
    content: [{ type: 'text' as const, text }],
  }
}
