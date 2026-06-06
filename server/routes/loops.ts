import { Router, Request, Response } from 'express';
import { createReadStream } from 'fs';
import { melodicLoopLibrary } from '../services/melodicLoopLibrary';

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

// Stream a loop file by its catalog relative path: /api/loops/file?p=<relPath>
router.get('/file', (req: Request, res: Response) => {
  try {
    const rel = String(req.query.p ?? '');
    if (!rel) return res.status(400).json({ success: false, message: "Missing 'p'" });
    const abs = melodicLoopLibrary.resolve(rel);
    if (!abs) return res.status(404).json({ success: false, message: 'Loop not found' });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(abs).pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export function createLoopRoutes() {
  return router;
}
