export type OrganismKitRole = 'kick' | 'snare' | 'hat' | 'perc' | 'tom' | 'bass808' | 'loop'

export interface OrganismKitSample {
  role: OrganismKitRole
  fileName: string
  relativePath: string
  url: string
  rootNote?: string
}

export interface OrganismKit {
  id: string
  name: string
  licenseNote: string
  root: string
  samples: OrganismKitSample[]
  priority: number
}

export interface OrganismKitResponse {
  success: boolean
  bestKitId: string | null
  count: number
  kits: OrganismKit[]
}

let cachePromise: Promise<OrganismKitResponse | null> | null = null

/**
 * Shared organism kit cache.
 *
 * The premium private kit is fetched once per session and shared between the
 * drum kit loader and the real 808 bass sampler. This prevents two separate
 * network requests to `/api/organism/kits` during the same cold start.
 */
export function loadOrganismKits(): Promise<OrganismKitResponse | null> {
  if (cachePromise) return cachePromise

  cachePromise = (async () => {
    try {
      if (typeof window === 'undefined' || !window.location?.origin) return null
      const response = await fetch(
        new URL('/api/organism/kits', window.location.origin).toString(),
      )
      if (!response.ok) return null
      const data = await response.json()
      const kits: OrganismKit[] = Array.isArray(data.kits) ? data.kits : []
      return {
        success: data.success ?? true,
        bestKitId: data.bestKitId ?? null,
        count: data.count ?? kits.length,
        kits,
      }
    } catch (err) {
      console.warn('[loadOrganismKits] kit fetch failed', err)
      return null
    }
  })()

  return cachePromise
}

/** Find the best bass808 sample in the cached kits. */
export async function findBass808Sample(): Promise<OrganismKitSample | null> {
  const response = await loadOrganismKits()
  if (!response) return null
  const bestKit = response.kits.find((k) => k.id === response.bestKitId) ?? response.kits[0]
  if (!bestKit) return null
  return bestKit.samples.find((s) => s.role === 'bass808') ?? null
}

/** Reset the cache. Useful for testing or after explicit refresh. */
export function clearOrganismKitCache(): void {
  cachePromise = null
}
