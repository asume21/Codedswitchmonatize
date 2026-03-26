import { z } from 'zod';
import { waitForCapture } from '../client.js';

export const analyzeAudioSchema = {
  capture_id: z.string().describe('The capture ID returned by capture_audio'),
};

const API_BASE = process.env.MCP_API_URL || 'https://www.codedswitch.com';
const API_KEY = process.env.CODEDSWITCH_API_KEY || 'dev-key-123';

export async function analyzeAudioHandler(args: { capture_id: string }) {
  let buffer: Buffer;
  try {
    buffer = await waitForCapture(args.capture_id, 2000);
  } catch {
    return {
      content: [{
        type: 'text' as const,
        text: `Capture "${args.capture_id}" not found. Run capture_audio first.`,
      }],
    };
  }

  try {
    const formData = new FormData();
    formData.append('audio', new Blob([new Uint8Array(buffer)], { type: 'audio/webm' }), 'capture.webm');

    const res = await fetch(`${API_BASE}/api/mcp/analyze`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned ${res.status}: ${errText}`);
    }

    const { report } = await res.json() as any;

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
    ].join('\n');

    return {
      content: [{ type: 'text' as const, text }],
    };
  } catch (err: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Analysis failed: ${err.message}`,
      }],
    };
  }
}
