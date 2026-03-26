/**
 * WebEar API Key Management Routes
 * Lets authenticated CodedSwitch users generate/revoke their webear API key.
 */

import { Router, type Request, type Response } from 'express';
import type { IStorage } from '../storage';
import { requireAuth } from '../middleware/auth';

export function createWebearKeyRoutes(storage: IStorage) {
  const router = Router();

  /**
   * GET /api/webear-keys
   * Get the current user's active API key (masked).
   */
  router.get('/', requireAuth(), async (req: Request, res: Response) => {
    try {
      const key = await storage.getWebearKeyByUserId(req.userId!);
      if (!key) {
        return res.json({ key: null });
      }
      // Mask: show first 8 chars + asterisks
      const masked = key.key.slice(0, 12) + '••••••••••••••••••••••••••••••••';
      res.json({
        id: key.id,
        maskedKey: masked,
        name: key.name,
        usageCount: key.usageCount,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/webear-keys/reveal
   * Return the full key once (for initial generation or re-copy).
   */
  router.get('/reveal', requireAuth(), async (req: Request, res: Response) => {
    try {
      const key = await storage.getWebearKeyByUserId(req.userId!);
      if (!key) {
        return res.status(404).json({ error: 'No active key. Generate one first.' });
      }
      res.json({ key: key.key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/webear-keys/generate
   * Generate a new key (revokes any existing one).
   */
  router.post('/generate', requireAuth(), async (req: Request, res: Response) => {
    try {
      const newKey = await storage.createWebearKey(req.userId!);
      res.json({ key: newKey.key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/webear-keys
   * Revoke the current key.
   */
  router.delete('/', requireAuth(), async (req: Request, res: Response) => {
    try {
      await storage.revokeWebearKey(req.userId!);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
