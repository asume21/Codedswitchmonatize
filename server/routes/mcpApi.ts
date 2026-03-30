import { Router, Request, Response } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { analyzePcm } from '../services/mcpAudioAnalysis';
import OpenAI from 'openai';
import type { IStorage } from '../storage';
import { getCreditService } from '../services/credits';

// Credit costs for webear API calls
const WEBEAR_CREDIT_COSTS = {
  analyze: 1,   // pure signal analysis — cheap
  describe: 2,  // OpenAI GPT-4o AI description — costs real money
} as const;

export function createMcpApiRoutes(storage: IStorage): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  const creditService = getCreditService(storage);

  /**
   * Validate the Bearer token against the webear_api_keys table.
   * Returns the userId on success, or sends a 401/402 response and returns null.
   */
  async function resolveUser(req: Request, res: Response): Promise<string | null> {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token || !token.startsWith('wbr_')) {
      res.status(401).json({
        error: 'Missing or invalid API key. Generate one at https://www.codedswitch.com/developer',
      });
      return null;
    }

    const keyRecord = await storage.getWebearKeyByValue(token);
    if (!keyRecord) {
      res.status(401).json({
        error: 'API key not found or revoked. Generate a new one at https://www.codedswitch.com/developer',
      });
      return null;
    }

    return keyRecord.userId;
  }

  async function decodeWebmToPcm(webmBuffer: Buffer): Promise<{ samples: Float32Array; sampleRate: number }> {
    const SAMPLE_RATE = 44100;
    return new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-f', 'f32le',
        '-ac', '1',
        '-ar', String(SAMPLE_RATE),
        'pipe:1',
      ]);

      const chunks: Buffer[] = [];
      ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      ff.stderr.on('data', () => {});

      ff.stdout.on('end', () => {
        const combined = Buffer.concat(chunks);
        const aligned = combined.buffer.slice(
          combined.byteOffset,
          combined.byteOffset + combined.byteLength
        );
        resolve({ samples: new Float32Array(aligned), sampleRate: SAMPLE_RATE });
      });

      ff.on('error', (err) => reject(new Error(`ffmpeg failed: ${err.message}`)));
      ff.on('close', (code) => {
        if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exited with code ${code}`));
      });

      ff.stdin.write(webmBuffer);
      ff.stdin.end();
    });
  }

  router.post('/analyze', upload.single('audio'), async (req: Request, res: Response) => {
    const userId = await resolveUser(req, res);
    if (!userId) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const cost = WEBEAR_CREDIT_COSTS.analyze;
    const hasCredits = await creditService.hasCredits(userId, cost);
    if (!hasCredits) {
      const balance = await creditService.getBalance(userId);
      return res.status(402).json({
        error: `Insufficient credits. Need ${cost}, have ${balance}. Buy more at https://www.codedswitch.com/buy-credits`,
        creditsNeeded: cost,
        creditsAvailable: balance,
      });
    }

    try {
      const decoded = await decodeWebmToPcm(req.file.buffer);
      const report = analyzePcm(decoded.samples, decoded.sampleRate);

      // Deduct credits + track usage
      await creditService.deductCredits(userId, cost, 'webear analyze_audio', { tool: 'analyze_audio' });
      const keyRecord = await storage.getWebearKeyByValue(
        req.headers['authorization']!.replace('Bearer ', '').trim()
      );
      if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

      res.json({ report });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/describe', upload.single('audio'), async (req: Request, res: Response) => {
    const userId = await resolveUser(req, res);
    if (!userId) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
    }

    const cost = WEBEAR_CREDIT_COSTS.describe;
    const hasCredits = await creditService.hasCredits(userId, cost);
    if (!hasCredits) {
      const balance = await creditService.getBalance(userId);
      return res.status(402).json({
        error: `Insufficient credits. Need ${cost}, have ${balance}. Buy more at https://www.codedswitch.com/buy-credits`,
        creditsNeeded: cost,
        creditsAvailable: balance,
      });
    }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const base64Audio = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype || 'audio/webm';

      const result = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe this audio in detail. What instruments do you hear? What is the genre, mood, rhythm, and tone? If it\'s ambient or structural, describe the textures and frequencies. Keep the description concise but highly analytical.',
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: mimeType.includes('wav') ? 'wav' : 'mp3',
                },
              },
            ],
          },
        ],
      });

      const description = result.choices[0]?.message?.content || 'No description generated.';

      // Deduct credits + track usage
      await creditService.deductCredits(userId, cost, 'webear describe_audio', { tool: 'describe_audio' });
      const keyRecord = await storage.getWebearKeyByValue(
        req.headers['authorization']!.replace('Bearer ', '').trim()
      );
      if (keyRecord) await storage.incrementWebearKeyUsage(keyRecord.id);

      res.json({ description });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
