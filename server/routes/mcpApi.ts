import { Router, Request, Response } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { analyzePcm } from '../services/mcpAudioAnalysis';
import { GoogleGenerativeAI } from "@google/generative-ai";

export function createMcpApiRoutes(): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  function requireMcpApiKey(req: Request, res: Response, next: any) {
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || req.body?.apiKey;
    
    // For local dev/testing without throwing errors if the user hasn't set it yet, we just bypass if local, or check it.
    // Default valid key for testing is 'dev-key-123'
    const validKey = process.env.CODEDSWITCH_API_KEY || 'dev-key-123';
    if (!apiKey || apiKey !== validKey) {
      return res.status(401).json({ error: 'Unauthorized. Invalid API Key.' });
    }
    next();
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
        resolve({
          samples: new Float32Array(aligned),
          sampleRate: SAMPLE_RATE,
        });
      });

      ff.on('error', (err) => reject(new Error(`ffmpeg failed: ${err.message}`)));
      ff.on('close', (code) => {
        if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exited with code ${code}`));
      });

      ff.stdin.write(webmBuffer);
      ff.stdin.end();
    });
  }

  router.post('/analyze', requireMcpApiKey, upload.single('audio'), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    try {
      const decoded = await decodeWebmToPcm(req.file.buffer);
      const report = analyzePcm(decoded.samples, decoded.sampleRate);
      res.json({ report });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/describe', requireMcpApiKey, upload.single('audio'), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    try {
      const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const inlineData = {
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype || "audio/webm"
        }
      };

      const result = await model.generateContent([
        "Describe this audio in detail. What instruments do you hear? What is the genre, mood, rhythm, and tone? If it's ambient or structural, describe the textures and frequencies. Keep the description concise but highly analytical.",
        inlineData
      ]);

      res.json({ description: result.response.text() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
