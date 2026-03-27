/**
 * webear Express Middleware
 *
 * Drop-in middleware that adds the audio debug bridge to any Express server.
 * Handles SSE for browser communication, capture command dispatch, and
 * audio blob storage/retrieval for the MCP server.
 *
 * Usage:
 *   import { webearMiddleware } from 'webear/middleware'
 *   app.use('/api/webear', webearMiddleware())
 *
 * Or with options:
 *   app.use('/api/webear', webearMiddleware({
 *     maxCaptures: 50,
 *     maxAgeMins: 15,
 *     devOnly: true,
 *   }))
 */

import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'

export interface WebEarMiddlewareOptions {
  /** Maximum number of captures to keep in memory (default: 50) */
  maxCaptures?: number
  /** Auto-evict captures older than this many minutes (default: 10) */
  maxAgeMins?: number
  /** Max upload size in bytes (default: 50MB) */
  maxUploadBytes?: number
  /** Only enable in development mode (default: true) */
  devOnly?: boolean
}

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

export function webearMiddleware(options: WebEarMiddlewareOptions = {}): Router {
  const {
    maxCaptures    = 50,
    maxAgeMins     = 10,
    maxUploadBytes = 50 * 1024 * 1024,
    devOnly        = true,
  } = options

  const router = Router()

  if (devOnly && process.env.NODE_ENV === 'production') {
    router.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'webear is disabled in production' })
    })
    return router
  }

  // ── In-memory state ────────────────────────────────────────────────
  const captures       = new Map<string, StoredCapture>()
  const pending:         PendingCommand[] = []
  const sseClients:      Set<Response> = new Set()

  // Evict old captures on interval
  setInterval(() => {
    const cutoff = Date.now() - maxAgeMins * 60 * 1000
    for (const [id, cap] of captures) {
      if (cap.createdAt.getTime() < cutoff) captures.delete(id)
    }
    if (captures.size > maxCaptures) {
      const sorted = Array.from(captures.entries()).sort(
        (a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime()
      )
      const toRemove = sorted.slice(0, captures.size - maxCaptures)
      for (const [id] of toRemove) captures.delete(id)
    }
  }, 60_000)

  function broadcastSSE(event: string, data: object) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const client of sseClients) {
      try { client.write(msg) } catch { sseClients.delete(client) }
    }
  }

  // ── SSE endpoint — browser subscribes here ─────────────────────────

  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type',       'text/event-stream')
    res.setHeader('Cache-Control',      'no-cache')
    res.setHeader('Connection',         'keep-alive')
    res.setHeader('X-Accel-Buffering',  'no')
    res.flushHeaders()

    sseClients.add(res)
    req.on('close', () => { sseClients.delete(res) })
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

    if (sseClients.size > 0) {
      broadcastSSE('capture', cmd)
    } else {
      pending.push(cmd)
    }

    res.json({ captureId, queued: sseClients.size === 0 })
  })

  // ── Capture upload — browser POSTs the recorded blob here ─────────
  // Accepts multipart/form-data. Requires multer or similar middleware
  // to be applied upstream, OR you can use the raw body fallback.

  router.post('/capture', (req: Request, res: Response) => {
    // If multer is available upstream, req.file will be populated
    const file      = (req as any).file as { buffer: Buffer; mimetype: string } | undefined
    const captureId = req.body?.captureId as string | undefined

    if (file && captureId) {
      captures.set(captureId, {
        id:         captureId,
        buffer:     file.buffer,
        mimeType:   file.mimetype || 'audio/webm',
        durationMs: Number(req.body?.durationMs ?? 0),
        createdAt:  new Date(),
      })
      res.json({ ok: true, captureId, bytes: file.buffer.length })
      return
    }

    // Fallback: read raw body for JSON with base64 audio
    const chunks: Buffer[] = []
    let totalSize = 0

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize > maxUploadBytes) {
        res.status(413).json({ error: 'Upload too large' })
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (res.writableEnded) return

      const raw = Buffer.concat(chunks)
      const contentType = req.headers['content-type'] || ''

      if (contentType.includes('application/json')) {
        try {
          const body = JSON.parse(raw.toString())
          const audioBuffer = Buffer.from(body.audio, 'base64')
          const id = body.captureId || crypto.randomUUID()

          captures.set(id, {
            id,
            buffer:     audioBuffer,
            mimeType:   body.mimeType || 'audio/webm',
            durationMs: Number(body.durationMs ?? 0),
            createdAt:  new Date(),
          })

          res.json({ ok: true, captureId: id, bytes: audioBuffer.length })
        } catch {
          res.status(400).json({ error: 'Invalid JSON body' })
        }
      } else if (contentType.includes('multipart/form-data')) {
        // Basic multipart parsing for when multer is not available
        const boundary = contentType.split('boundary=')[1]
        if (!boundary) {
          res.status(400).json({ error: 'Missing multipart boundary' })
          return
        }

        const parsed = parseMultipartBasic(raw, boundary)
        if (!parsed.captureId) {
          res.status(400).json({ error: 'Missing captureId field' })
          return
        }

        if (parsed.audioBuffer) {
          captures.set(parsed.captureId, {
            id:         parsed.captureId,
            buffer:     parsed.audioBuffer,
            mimeType:   parsed.mimeType || 'audio/webm',
            durationMs: Number(parsed.durationMs ?? 0),
            createdAt:  new Date(),
          })
          res.json({ ok: true, captureId: parsed.captureId, bytes: parsed.audioBuffer.length })
        } else {
          res.status(400).json({ error: 'Missing audio file in upload' })
        }
      } else {
        res.status(400).json({ error: 'Unsupported content type' })
      }
    })
  })

  // ── Capture retrieval — MCP server GETs the blob here ─────────────

  router.get('/capture/:id', (req: Request, res: Response) => {
    const cap = captures.get(req.params.id as string)
    if (!cap) {
      res.status(404).json({ error: 'Capture not found or not yet ready' })
      return
    }
    res.setHeader('Content-Type', String(cap.mimeType))
    res.setHeader('X-Duration-Ms', String(cap.durationMs))
    res.send(cap.buffer)
  })

  // ── List captures ─────────────────────────────────────────────────

  router.get('/captures', (_req: Request, res: Response) => {
    const list = Array.from(captures.values()).map(c => ({
      id:         c.id,
      durationMs: c.durationMs,
      bytes:      c.buffer.length,
      createdAt:  c.createdAt.toISOString(),
    }))
    res.json(list)
  })

  // ── Health check ──────────────────────────────────────────────────

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok:              true,
      sseClients:      sseClients.size,
      capturesStored:  captures.size,
      pendingCommands: pending.length,
    })
  })

  return router
}

// ── Basic multipart parser (no external deps) ───────────────────────────────

interface MultipartResult {
  captureId?:    string
  audioBuffer?:  Buffer
  mimeType?:     string
  durationMs?:   string
}

function parseMultipartBasic(raw: Buffer, boundary: string): MultipartResult {
  const result: MultipartResult = {}
  const sep = Buffer.from(`--${boundary}`)
  const parts: Buffer[] = []

  let start = 0
  while (true) {
    const idx = raw.indexOf(sep, start)
    if (idx === -1) break
    if (start > 0) {
      // Strip leading \r\n and trailing \r\n before boundary
      let partStart = start
      let partEnd = idx
      if (raw[partStart] === 0x0d && raw[partStart + 1] === 0x0a) partStart += 2
      if (raw[partEnd - 2] === 0x0d && raw[partEnd - 1] === 0x0a) partEnd -= 2
      if (partEnd > partStart) {
        parts.push(raw.slice(partStart, partEnd))
      }
    }
    start = idx + sep.length
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue

    const headers = part.slice(0, headerEnd).toString()
    const body    = part.slice(headerEnd + 4)

    const nameMatch = headers.match(/name="([^"]+)"/)
    const name = nameMatch?.[1]

    if (!name) continue

    const filenameMatch = headers.match(/filename="([^"]+)"/)
    const isFile = !!filenameMatch

    if (name === 'audio' && isFile) {
      result.audioBuffer = body
      const ctMatch = headers.match(/Content-Type:\s*(.+)/i)
      result.mimeType = ctMatch?.[1]?.trim()
    } else if (name === 'captureId') {
      result.captureId = body.toString().trim()
    } else if (name === 'durationMs') {
      result.durationMs = body.toString().trim()
    }
  }

  return result
}

export default webearMiddleware
