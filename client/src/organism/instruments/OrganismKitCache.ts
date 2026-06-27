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

// Cymatics "Rumble" 808 (Classic, tuned to C) — committed under server/Assets
// and served from the public /assets mount. Used as the recorded-808 source
// when no premium private kit provides a bass808, so trap/drill/heat bass plays
// a real producer 808 instead of the synthesised fatsine fallback.
const CYMATICS_808_FALLBACK: OrganismKitSample = {
  role: 'bass808',
  fileName: '808-classic.wav',
  relativePath: 'bass/cymatics/808-classic.wav',
  url: '/assets/bass/cymatics/808-classic.wav',
  rootNote: 'C1',
}

/** Find the best bass808 sample: premium private kit first, else the committed
 *  Cymatics Rumble 808. Never null so the recorded 808 always upgrades the synth. */
export async function findBass808Sample(): Promise<OrganismKitSample | null> {
  const response = await loadOrganismKits()
  const bestKit = response?.kits.find((k) => k.id === response.bestKitId) ?? response?.kits[0]
  const premium = bestKit?.samples.find((s) => s.role === 'bass808')
  return premium ?? CYMATICS_808_FALLBACK
}

/** Reset the cache. Useful for testing or after explicit refresh. */
export function clearOrganismKitCache(): void {
  cachePromise = null
}
