import type { InstrumentRole } from './arrangementRole'

/**
 * Musical foreground ownership. This is deliberately separate from mixer solo:
 * isolating a channel changes what is heard; featuring a player changes what the
 * band plays across the existing song arrangement.
 */
export type FeaturedPerformance =
  | 'none'
  | 'melody'
  | 'chord'
  | 'texture'
  | 'melody-chords'

export type FeaturedGeneratorRole = 'drums' | 'bass' | 'melody' | 'chord' | 'texture'

export function isFeaturedRole(
  feature: FeaturedPerformance,
  role: FeaturedGeneratorRole,
): boolean {
  if (feature === 'melody-chords') return role === 'melody' || role === 'chord'
  return feature === role
}

/** Preserve a composer's plan when Feature is off; otherwise make the rhythm
 * section/supporting harmony frame the requested foreground player. */
export function resolveFeaturedRole(
  feature: FeaturedPerformance,
  role: FeaturedGeneratorRole,
  plannedRole: InstrumentRole,
): InstrumentRole {
  if (feature === 'none') return plannedRole
  return isFeaturedRole(feature, role) ? 'lead' : 'support'
}

/** A quiet verse multiplier must not make the selected foreground disappear.
 * Section-specific phrase shape/dynamics still create the full-song arc. */
export function featuredArrangementMultiplier(
  feature: FeaturedPerformance,
  role: FeaturedGeneratorRole,
  plannedMultiplier: number,
): number {
  if (!isFeaturedRole(feature, role)) return plannedMultiplier
  return Math.max(0.72, plannedMultiplier)
}
