/**
 * Cuts a bar-aligned loop out of a longer render.
 *
 * Pairs with loopPlan: the plan decides how long to generate and where the cut
 * falls, this performs the cut. ffmpeg is installed in the production image
 * (see Dockerfile), and fluent-ffmpeg is already a dependency.
 *
 * Re-encodes rather than stream-copying. A copy can only cut on a frame
 * boundary, which for MP3 is ~26ms of slop — audible as a stutter at the loop
 * point, and enough to knock a bar-aligned cut off the grid.
 */

import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import { GENERATED_AUDIO_DIR, generatedAudioUrl } from './generatedAudioStore'

export interface SlicedLoop {
  /** Absolute path of the sliced file. */
  path: string
  /** URL that serves it. */
  url: string
  /** Length of the slice in seconds. */
  durationS: number
}

/**
 * Write `durationS` seconds starting at `startS` to a new file in the store.
 *
 * Returns null on any failure so the caller can fall back to the full-length
 * render — a longer-than-asked-for loop is still usable audio, whereas throwing
 * would discard a generation that was already paid for.
 */
export async function sliceLoop(
  inputPath: string,
  { startS, durationS }: { startS: number; durationS: number },
): Promise<SlicedLoop | null> {
  if (!fs.existsSync(inputPath)) {
    console.warn(`[loopSlicer] input missing: ${inputPath}`)
    return null
  }

  const extension = path.extname(inputPath) || '.mp3'
  const filename = `loop-${randomUUID()}${extension}`
  const outputPath = path.join(GENERATED_AUDIO_DIR, filename)

  try {
    fs.mkdirSync(GENERATED_AUDIO_DIR, { recursive: true })

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        // -ss before the input is fast but seeks to the nearest keyframe;
        // .seekInput after decode is sample-accurate, which is what a
        // bar-aligned cut needs.
        .setStartTime(startS)
        .setDuration(durationS)
        .audioCodec('libmp3lame')
        .audioBitrate('320k')
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputPath)
    })

    const written = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
    if (written === 0) {
      console.warn('[loopSlicer] ffmpeg produced an empty file')
      return null
    }

    return { path: outputPath, url: generatedAudioUrl(filename), durationS }
  } catch (err) {
    console.warn(
      '[loopSlicer] slice failed, falling back to the full render:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}
