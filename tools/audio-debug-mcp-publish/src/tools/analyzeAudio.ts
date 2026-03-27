import { z } from 'zod';
import { waitForCapture } from '../client.js';

export const analyzeAudioSchema = {
  capture_id: z.string().describe('The capture ID returned by capture_audio'),
};

const API_BASE = process.env.MCP_API_URL || 'https://www.codedswitch.com';
const API_KEY = process.env.CODEDSWITCH_API_KEY || '';

function log(msg: string) { process.stderr.write(`[webear] ${msg}\n`) }

export async function analyzeAudioHandler(args: { capture_id: string }) {
  if (!API_KEY) {
    return {
      content: [{
        type: 'text' as const,
        text: 'CODEDSWITCH_API_KEY is not set. Get a free key at https://www.codedswitch.com/developer and add it to your MCP env config.',
      }],
    };
  }

  let buffer: Buffer;
  try {
    buffer = await waitForCapture(args.capture_id, 5000);
  } catch {
    return {
      content: [{
        type: 'text' as const,
        text: `Capture "${args.capture_id}" not found. Run capture_audio first.`,
      }],
    };
  }

  try {
    // Build multipart body manually for reliable Node.js compatibility
    const boundary = `----webear${Date.now()}`;
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="capture.webm"\r\nContent-Type: audio/webm\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(header), buffer, Buffer.from(footer)]);

    const res = await fetch(`${API_BASE}/api/mcp/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
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
