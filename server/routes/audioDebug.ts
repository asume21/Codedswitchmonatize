/**
 * Audio Debug Bridge — server side (dev mode only)
 *
 * Three concerns:
 *   1. SSE channel → browser listens here for capture commands
 *   2. Command endpoint → MCP server POSTs here to trigger a capture
 *   3. Capture storage → browser POSTs the recorded blob here; MCP server retrieves it
 */

import { Router, Request, Response } from 'express'
import multer from 'multer'
import crypto from 'crypto'

export function createAudioDebugRoutes(): Router {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

  // ── In-memory state ────────────────────────────────────────────────

  interface StoredCapture {
    id:         string
    buffer:     Buffer
    mimeType:   string
    durationMs: number
    createdAt:  Date
  }

  interface PendingCommand {
    type:       'capture'
    captureId:  string
    durationMs: number
    queuedAt:   Date
  }

  const captures     = new Map<string, StoredCapture>()
  const pending:       PendingCommand[] = []
  let   sseRes:        Response | null = null

  // Evict captures older than 10 minutes to prevent memory leaks
  setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000
    for (const [id, cap] of captures) {
      if (cap.createdAt.getTime() < cutoff) captures.delete(id)
    }
  }, 60_000)

  // ── SSE endpoint — browser subscribes here ─────────────────────────

  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    sseRes = res

    req.on('close', () => {
      if (sseRes === res) sseRes = null
    })
  })

  // ── Pending commands drain — called by browser on SSE reconnect ────

  router.get('/pending-commands', (_req: Request, res: Response) => {
    const cmds = pending.splice(0)
    res.json(cmds)
  })

  // ── Command endpoint — MCP server POSTs here ───────────────────────

  router.post('/command', (req: Request, res: Response) => {
    const durationMs = Number(req.body?.duration_ms ?? req.body?.durationMs ?? 3000)
    const captureId  = crypto.randomUUID()

    const cmd: PendingCommand = {
      type:      'capture',
      captureId,
      durationMs,
      queuedAt:  new Date(),
    }

    if (sseRes) {
      sseRes.write(`event: capture\ndata: ${JSON.stringify(cmd)}\n\n`)
    } else {
      pending.push(cmd)
    }

    res.json({ captureId, queued: !sseRes })
  })

  // ── Capture upload — browser POSTs the recorded blob here ─────────

  router.post('/capture', upload.single('audio'), (req: Request, res: Response) => {
    const file      = (req as any).file as Express.Multer.File | undefined
    const captureId = req.body?.captureId as string | undefined

    if (!file || !captureId) {
      res.status(400).json({ error: 'Missing audio or captureId' })
      return
    }

    captures.set(captureId, {
      id:         captureId,
      buffer:     file.buffer,
      mimeType:   file.mimetype || 'audio/webm',
      durationMs: Number(req.body?.durationMs ?? 0),
      createdAt:  new Date(),
    })

    res.json({ ok: true, captureId, bytes: file.buffer.length })
  })

  // ── Capture retrieval — MCP server GETs the blob here ─────────────

  router.get('/capture/:id', (req: Request, res: Response) => {
    const cap = captures.get(req.params.id)
    if (!cap) {
      res.status(404).json({ error: 'Capture not found or not yet ready' })
      return
    }
    res.setHeader('Content-Type', cap.mimeType)
    res.setHeader('X-Duration-Ms', String(cap.durationMs))
    res.send(cap.buffer)
  })

  // ── List captures — useful for MCP server to know what's available ─

  router.get('/captures', (_req: Request, res: Response) => {
    const list = Array.from(captures.values()).map(c => ({
      id:         c.id,
      durationMs: c.durationMs,
      bytes:      c.buffer.length,
      createdAt:  c.createdAt.toISOString(),
    }))
    res.json(list)
  })

  return router
}
