/**
 * Replicate output normalisation — the single seam that turns whatever
 * `replicate.run()` hands back into a plain URL string.
 *
 * WHY THIS EXISTS
 * The Replicate JS client has defaulted `useFileOutput: true` since v1, so
 * `replicate.run()` no longer resolves URL strings. Every `https:`/`data:`
 * value in a model's output is wrapped in a `FileOutput` — a `ReadableStream`
 * subclass carrying `url()` and `toString()`.
 *
 * `FileOutput` has no `toJSON` and no own enumerable properties, so
 * `JSON.stringify(fileOutput) === '{}'`. A `value as string` cast is erased at
 * compile time and does nothing to stop it: the object sails through the type
 * checker and lands in the API response as `"audioUrl": {}`. That is exactly
 * how generated sample packs shipped with four samples that had nothing to
 * play — the packs rendered, the cards appeared, every URL was an empty object.
 *
 * The call sites that never broke were the ones that happened to write
 * `String(output)`, which invokes `FileOutput.toString()` by luck rather than
 * intent. Route every consumer of `replicate.run()` through here instead.
 */

/** Keys models commonly hang their audio output on, in preference order. */
const AUDIO_KEYS = ['audio', 'audio_url', 'audio_out', 'url', 'output', 'file'] as const

const isUrlString = (value: unknown): value is string =>
  typeof value === 'string' && /^(https?:|data:)/i.test(value)

/**
 * Coerce one Replicate output value to a URL string.
 *
 * Handles plain strings, `FileOutput` (via `url()`, falling back to a custom
 * `toString()`), and anything URL-like. Returns undefined for null, plain
 * objects, and non-URL strings — never `"[object Object]"`, which would become
 * a same-origin request for a file that cannot exist.
 */
export function toReplicateUrl(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined

  if (typeof value === 'string') return isUrlString(value) ? value : undefined

  if (value instanceof URL) return isUrlString(value.href) ? value.href : undefined

  if (typeof value === 'object') {
    const candidate = value as { url?: unknown; toString?: unknown }

    // FileOutput.url() returns a URL instance.
    if (typeof candidate.url === 'function') {
      try {
        const fromUrl = String((candidate.url as () => unknown).call(candidate))
        if (isUrlString(fromUrl)) return fromUrl
      } catch {
        // fall through to toString()
      }
    }

    // FileOutput.toString() returns the raw URL. Guard against the inherited
    // Object.prototype.toString, which would yield "[object Object]".
    if (candidate.toString !== Object.prototype.toString) {
      try {
        const fromString = String(value)
        if (isUrlString(fromString)) return fromString
      } catch {
        // not stringifiable — fall through
      }
    }
  }

  return undefined
}

/**
 * Dig a single audio URL out of a whole model output, whichever shape the
 * model uses: a bare value, an array, or an object keyed by {@link AUDIO_KEYS}.
 * Each candidate is resolved through {@link toReplicateUrl}, so `FileOutput`
 * works at every level.
 */
export function extractReplicateAudioUrl(output: unknown): string | undefined {
  if (output === null || output === undefined) return undefined

  const direct = toReplicateUrl(output)
  if (direct) return direct

  if (Array.isArray(output)) {
    for (const item of output) {
      const url = toReplicateUrl(item)
      if (url) return url
    }
    return undefined
  }

  if (typeof output === 'object') {
    const record = output as Record<string, unknown>
    for (const key of AUDIO_KEYS) {
      const url = toReplicateUrl(record[key])
      if (url) return url

      const nested = record[key]
      if (Array.isArray(nested)) {
        for (const item of nested) {
          const fromArray = toReplicateUrl(item)
          if (fromArray) return fromArray
        }
      }
    }
  }

  return undefined
}
