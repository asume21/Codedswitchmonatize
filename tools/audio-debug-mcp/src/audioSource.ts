/**
 * Where a tool's audio comes from: a live capture from the running app, or an
 * audio file on disk (an ACE render, a reference beat, an exported mix).
 *
 * Files are read here and PIPED into ffmpeg — the path itself never reaches
 * ffmpeg's argv, so its URL/protocol handling (http:, concat:, …) can't be
 * reached through a crafted "path". Paths must be absolute, carry an audio
 * extension, and stay under a size cap.
 */
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, extname, basename } from 'node:path'
import { waitForCapture } from './client.js'

export const MAX_FILE_BYTES = 200 * 1024 * 1024

const FILE_MIME: Record<string, string> = {
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.webm': 'audio/webm',
  '.ogg':  'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a':  'audio/mp4',
  '.aac':  'audio/aac',
}

export const audioSourceFields = {
  capture_id: z.string().optional().describe('A capture ID returned by capture_audio'),
  file: z.string().optional().describe(
    'Absolute path to a local audio file (wav, mp3, webm, ogg, opus, flac, m4a, aac) — e.g. an ACE render or a reference beat. Use instead of capture_id.',
  ),
}

export interface AudioSourceArgs { capture_id?: string; file?: string }

export interface LoadedAudio {
  /** Short name for reports. */
  label: string
  bytes: Buffer
  mime: string
}

export class AudioSourceError extends Error {}

export async function loadAudio(args: AudioSourceArgs): Promise<LoadedAudio> {
  const hasCapture = !!args.capture_id?.trim()
  const hasFile = !!args.file?.trim()
  if (hasCapture === hasFile) {
    throw new AudioSourceError('Pass exactly one of capture_id or file.')
  }

  if (hasCapture) {
    const id = args.capture_id!.trim()
    try {
      return { label: `capture ${id.slice(0, 8)}…`, bytes: await waitForCapture(id, 2000), mime: 'audio/webm' }
    } catch {
      throw new AudioSourceError(`Capture "${id}" not found. Run capture_audio first.`)
    }
  }

  const file = args.file!.trim()
  if (!isAbsolute(file)) throw new AudioSourceError(`file must be an absolute path: "${file}"`)
  const mime = FILE_MIME[extname(file).toLowerCase()]
  if (!mime) {
    throw new AudioSourceError(`Unsupported file type "${extname(file)}". Use one of: ${Object.keys(FILE_MIME).join(', ')}`)
  }
  let size: number
  try {
    const st = await stat(file)
    if (!st.isFile()) throw new AudioSourceError(`Not a file: "${file}"`)
    size = st.size
  } catch (err) {
    if (err instanceof AudioSourceError) throw err
    throw new AudioSourceError(`File not found: "${file}"`)
  }
  if (size > MAX_FILE_BYTES) {
    throw new AudioSourceError(`File is ${(size / 1e6).toFixed(0)} MB — the limit is ${MAX_FILE_BYTES / 1e6} MB.`)
  }
  return { label: basename(file), bytes: await readFile(file), mime }
}

/** Run ffmpeg over piped bytes and collect its stdout. */
function ffmpegPipe(input: Buffer, outArgs: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', ...outArgs, 'pipe:1'])
    const chunks: Buffer[] = []
    let errText = ''
    ff.stdout.on('data', (c: Buffer) => chunks.push(c))
    ff.stderr.on('data', (c: Buffer) => { errText = (errText + c.toString()).slice(-500) })
    ff.on('error', (err) => reject(new Error(`ffmpeg not found or failed: ${err.message}. Install ffmpeg and put it on PATH.`)))
    ff.on('close', (code) => {
      if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exited with code ${code}: ${errText.trim()}`))
      else resolve(Buffer.concat(chunks))
    })
    // ffmpeg may close stdin early once it has what it needs — not an error.
    ff.stdin.on('error', () => {})
    ff.stdin.end(input)
  })
}

export const ANALYSIS_SAMPLE_RATE = 44100

/** Decode any supported audio to mono float PCM for analysis. */
export async function decodeToPcm(bytes: Buffer): Promise<{ samples: Float32Array; sampleRate: number }> {
  const out = await ffmpegPipe(bytes, ['-f', 'f32le', '-ac', '1', '-ar', String(ANALYSIS_SAMPLE_RATE)])
  // Copy into a fresh, 4-byte-aligned buffer for Float32Array.
  const aligned = new Uint8Array(out.byteLength - (out.byteLength % 4))
  aligned.set(out.subarray(0, aligned.byteLength))
  return { samples: new Float32Array(aligned.buffer), sampleRate: ANALYSIS_SAMPLE_RATE }
}
