import { Router, Request, Response } from 'express';
import { createReadStream, readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { melodicLoopLibrary } from '../services/melodicLoopLibrary';
import { multisampleInstruments } from '../services/multisampleInstruments';

const PACKS_DIR = join(process.cwd(), 'server', 'data', 'loop-packs');

/**
 * Melodic Loop Routes — real instrument loop packs for the Organism's loop layer.
 * Public (like /api/samples): the loop audio is not user data. See
 * services/melodicLoopLibrary.ts.
 */
const router = Router();

// Catalog of available loops (parsed bpm/key/instrument metadata).
router.get('/', (req: Request, res: Response) => {
  try {
    const loops = melodicLoopLibrary.scan(req.query.refresh === '1');
    res.json({ success: true, count: loops.length, loops });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Derived chop catalog: bar/half-bar/two-bar slices from phrase loops. The
// audio still streams from the source loop; chops provide offsets/durations.
router.get('/chops', (req: Request, res: Response) => {
  try {
    const chops = melodicLoopLibrary.chops(req.query.refresh === '1');
    res.json({ success: true, count: chops.length, chops });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Playable multisample instruments (note-mapped one-shots → Tone.Sampler maps).
router.get('/instruments', (req: Request, res: Response) => {
  try {
    const instruments = multisampleInstruments.scan(req.query.refresh === '1');
    res.json({ success: true, count: instruments.length, instruments });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stream a loop file by its catalog relative path: /api/loops/file?p=<relPath>
router.get('/file', (req: Request, res: Response) => {
  try {
    const rel = String(req.query.p ?? '');
    if (!rel) return res.status(400).json({ success: false, message: "Missing 'p'" });
    const abs = melodicLoopLibrary.resolve(rel);
    if (!abs) return res.status(404).json({ success: false, message: 'Loop not found' });
    const mime = /\.ogg$/i.test(abs) ? 'audio/ogg' : /\.mp3$/i.test(abs) ? 'audio/mpeg' : 'audio/wav';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(abs).pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List all available packs (id, genre, label, bpm, key only — no loop URLs)
router.get('/packs', (_req: Request, res: Response) => {
  try {
    if (!existsSync(PACKS_DIR)) return res.json({ packs: [] });
    const packs = readdirSync(PACKS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const raw = JSON.parse(readFileSync(join(PACKS_DIR, f), 'utf-8'));
        return { id: raw.id, genre: raw.genre, label: raw.label, bpm: raw.bpm, key: raw.key };
      });
    res.json({ packs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Full pack manifest including loop URLs
router.get('/packs/:id', (req: Request, res: Response) => {
  try {
    const file = join(PACKS_DIR, `${req.params.id}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: 'Pack not found' });
    const pack = JSON.parse(readFileSync(file, 'utf-8'));
    res.json({ pack });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export function createLoopRoutes() {
  return router;
}
