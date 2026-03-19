import type { OrganismMode } from '../physics/types'

// ── Physics Profile ───────────────────────────────────────────────────
// A set of biases that nudge the PhysicsEngine's starting constants
// toward this user's characteristic style.
// Values are offsets — not absolute values.
// Range: -0.3 to +0.3 for all fields except pulseOffset (BPM).

export interface PhysicsProfile {
  userId:      string
  computedAt:  number    // Unix ms
  sessionCount: number   // how many sessions this is based on

  // Constant biases (added to computed value before clamping)
  bounceBias:   number   // -0.3 to +0.3
  swingBias:    number   // -0.1 to +0.1 (swing range is smaller)
  pocketBias:   number   // -0.3 to +0.3
  presenceBias: number   // -0.3 to +0.3
  densityBias:  number   // -0.3 to +0.3
  pulseBias:    number   // BPM offset — -15 to +15

  // Mode distribution bias
  // Adds to the mode classifier's rule weights
  // Positive = more likely to classify as this mode
  modeBias: Record<OrganismMode, number>  // -0.2 to +0.2 per mode

  // Confidence: 0 (no sessions) to 1 (many sessions, strong signal)
  confidence: number
}

export const NULL_PROFILE: PhysicsProfile = {
  userId:       '',
  computedAt:   0,
  sessionCount: 0,
  bounceBias:   0,
  swingBias:    0,
  pocketBias:   0,
  presenceBias: 0,
  densityBias:  0,
  pulseBias:    0,
  modeBias: {
    heat:   0,
    ice:    0,
    smoke:  0,
    gravel: 0,
    glow:   0,
  } as Record<OrganismMode, number>,
  confidence:   0,
}

// ── Physics Skin (v2 — define type now, implement later) ─────────────

export interface PhysicsSkin {
  skinId:      string
  authorId:    string
  name:        string
  description: string
  createdAt:   number
  // Same structure as PhysicsProfile biases but user-crafted, not computed
  bounceBias:   number
  swingBias:    number
  pocketBias:   number
  presenceBias: number
  densityBias:  number
  pulseBias:    number
  modeBias:     Record<OrganismMode, number>
  // Social
  downloadCount: number
  rating:        number
}
