import { Router, Request, Response } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { analyzePcm } from '../services/mcpAudioAnalysis';
import { describeAudio } from '../services/audioDescribe';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

async function decodeWebmToPcm(buf: Buffer): Promise<{ samples: Float32Array; sampleRate: number }> {
  const SR = 44100;
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1']);
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', () => {});
    ff.stdout.on('end', () => {
      const combined = Buffer.concat(chunks);
      const aligned = combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength);
      resolve({ samples: new Float32Array(aligned), sampleRate: SR });
    });
    ff.on('error', (e) => reject(new Error(`ffmpeg: ${e.message}`)));
    ff.on('close', (code) => { if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exited ${code}`)); });
    ff.stdin.write(buf);
    ff.stdin.end();
  });
}

// POST /api/demo/perceive
// Public endpoint — no auth, no credits. Accepts audio/webm blob, returns perception JSON.
// Used by the /demo page for the live AI Perception demo.
router.post('/perceive', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No audio file provided.' });

    const buf = file.buffer;

    // Decode + signal analysis (always)
    const decoded = await decodeWebmToPcm(buf);
    const report = analyzePcm(decoded.samples, decoded.sampleRate);

    // AI description (best-effort — skip gracefully if no provider key)
    let description: string | null = null;
    try {
      description = await describeAudio(buf);
    } catch {
      description = null;
    }

    const bands = report.bandEnergy;
    res.json({
      bpm:          report.estimatedBpm ?? null,
      rmsDb:        report.rmsDb,
      peakDb:       report.peakDb,
      dynamicRange: report.dynamicRangeDb,
      clipping: {
        percent: report.clippingPercent,
        count:   report.clippedSampleCount,
      },
      spectralCentroidHz: report.spectralCentroidHz ?? null,
      bands: {
        sub:    bands.sub,
        bass:   bands.bass,
        lowMid: bands.lowMid,
        mid:    bands.highMid,
        high:   bands.high,
      },
      description,
      durationSec: Math.round(decoded.samples.length / decoded.sampleRate),
    });
  } catch (err: any) {
    console.error('[demo/perceive]', err);
    res.status(500).json({ error: err?.message ?? 'Analysis failed.' });
  }
});

export default router;
