/**
 * sampleProfileCache — fetches the DSP profile manifest once per session and
 * makes it available for O(1) lookup by filename.
 *
 * The server builds this from `scripts/profile-samples.ts` → `server/data/sample-profiles.json`.
 * Each profile has energy/brightness/punch/subWeight/bassWeight so the kit selector
 * can rank samples by how well they fit the target genre instead of using hardcoded names.
 */

export interface SampleProfile {
  category:           string   // kick | snare | hihat | clap | 808 | perc | bass | melody | other
  energy:             number   // 0–1
  brightness:         number   // 0–1
  punch:              number   // 0–1  (crest factor — how transient/snappy)
  subWeight:          number   // 0–1  (sub-bass band fraction)
  bassWeight:         number   // 0–1  (bass band fraction)
  durationMs:         number
  rmsDb:              number
  spectralCentroidHz: number
  profiledAt:         string
}

let cachePromise: Promise<Map<string, SampleProfile>> | null = null

/**
 * Returns a filename → SampleProfile map.
 * Keyed by basename (e.g. "kick_808.wav"), not full path.
 * Call once; result is cached for the session lifetime.
 */
export function loadSampleProfiles(): Promise<Map<string, SampleProfile>> {
  if (cachePromise) return cachePromise

  cachePromise = (async () => {
    const map = new Map<string, SampleProfile>()
    try {
      if (typeof window === 'undefined') return map
      const res = await fetch('/api/sample-profiles')
      if (!res.ok) return map
      const data = await res.json()
      const byFilename = data.byFilename ?? {}
      for (const [filename, profile] of Object.entries(byFilename)) {
        map.set(filename, profile as SampleProfile)
      }
      console.info(`[sampleProfiles] loaded ${map.size} profiles`)
    } catch (err) {
      console.warn('[sampleProfiles] fetch failed — kit will use filename-based selection', err)
    }
    return map
  })()

  return cachePromise
}

/** Look up a sample profile by its filename or URL tail. Returns null if not profiled yet. */
export function getProfileByFilename(
  profiles: Map<string, SampleProfile>,
  filenameOrUrl: string,
): SampleProfile | null {
  // Strip URL prefix: "/api/samples/kick_808.wav" → "kick_808.wav"
  const filename = filenameOrUrl.split('/').pop() ?? filenameOrUrl
  return profiles.get(filename) ?? null
}

/** Score a sample for a given voice role and genre target (0 = worst, 1 = perfect). */
export function scoreForVoice(
  profile: SampleProfile,
  voice: 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'perc',
  target: GenreTarget,
): number {
  switch (voice) {
    case 'kick':
      // Blend sub weight (the bass punch) and inverse brightness (dark kicks are heavier)
      return 0.6 * (1 - Math.abs(profile.subWeight - target.kickSubWeight))
           + 0.4 * (1 - Math.abs(profile.brightness - target.kickBrightness))
    case 'snare':
      return 0.7 * (1 - Math.abs(profile.punch - target.snarePunch))
           + 0.3 * (1 - Math.abs(profile.brightness - target.snareBrightness))
    case 'hatClosed':
    case 'hatOpen':
      return 1 - Math.abs(profile.brightness - target.hatBrightness)
    case 'perc':
      return 0.5 * (1 - Math.abs(profile.punch - target.snarePunch))
           + 0.5 * (1 - Math.abs(profile.energy - target.energy))
    default:
      return 0.5
  }
}

/** Genre-level sonic targets. All values 0–1. */
export interface GenreTarget {
  kickSubWeight:    number   // how much sub-bass we want in the kick
  kickBrightness:   number   // kick brightness (low = dark/wobbly 808, high = clicky)
  snarePunch:       number   // how transient/snappy the snare should be
  snareBrightness:  number   // snare tone (low = fat, high = crispy crack)
  hatBrightness:    number   // hat brightness (low = dark/tight, high = open/sizzle)
  energy:           number   // overall energy level 0–1
}

/** Pre-built targets per sub-genre. Add more as needed. */
export const GENRE_TARGETS: Record<string, GenreTarget> = {
  'trap':      { kickSubWeight: 0.65, kickBrightness: 0.15, snarePunch: 0.7,  snareBrightness: 0.5, hatBrightness: 0.2, energy: 0.8 },
  'drill':     { kickSubWeight: 0.75, kickBrightness: 0.10, snarePunch: 0.75, snareBrightness: 0.4, hatBrightness: 0.2, energy: 0.85 },
  'hip-hop':   { kickSubWeight: 0.45, kickBrightness: 0.3,  snarePunch: 0.8,  snareBrightness: 0.6, hatBrightness: 0.5, energy: 0.7 },
  'boom-bap':  { kickSubWeight: 0.35, kickBrightness: 0.4,  snarePunch: 0.9,  snareBrightness: 0.7, hatBrightness: 0.6, energy: 0.65 },
  'lo-fi':     { kickSubWeight: 0.3,  kickBrightness: 0.35, snarePunch: 0.4,  snareBrightness: 0.4, hatBrightness: 0.45, energy: 0.45 },
  'rnb':       { kickSubWeight: 0.4,  kickBrightness: 0.3,  snarePunch: 0.6,  snareBrightness: 0.55, hatBrightness: 0.55, energy: 0.6 },
  'pop':       { kickSubWeight: 0.4,  kickBrightness: 0.4,  snarePunch: 0.7,  snareBrightness: 0.65, hatBrightness: 0.7, energy: 0.7 },
  'afrobeats': { kickSubWeight: 0.5,  kickBrightness: 0.35, snarePunch: 0.65, snareBrightness: 0.6,  hatBrightness: 0.65, energy: 0.75 },
  'dancehall': { kickSubWeight: 0.55, kickBrightness: 0.25, snarePunch: 0.7,  snareBrightness: 0.55, hatBrightness: 0.6, energy: 0.8 },
}

export function getGenreTarget(subGenre: string): GenreTarget {
  return GENRE_TARGETS[subGenre] ?? GENRE_TARGETS['hip-hop']
}
