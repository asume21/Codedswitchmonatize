import type { PhysicsProfile } from './types'
import type { SessionDNA }     from '../session/types'
import { OrganismMode }        from '../physics/types'
import { NULL_PROFILE }        from './types'

export function computeProfile(
  userId:   string,
  sessions: SessionDNA[]
): PhysicsProfile {
  if (sessions.length === 0) return { ...NULL_PROFILE, userId }

  // Weight recent sessions more than older ones
  // Session at index i gets weight = (i+1) / sum(1..n)
  const weights = sessions.map((_, i) => (i + 1))
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const w = weights.map(wi => wi / weightSum)

  // Weighted average of each physics constant
  const wavg = (getter: (s: SessionDNA) => number) =>
    sessions.reduce((sum, s, i) => sum + getter(s) * w[i], 0)

  const avgBounce   = wavg(s => s.avgBounce)
  const avgSwing    = wavg(s => s.avgSwing)
  const avgPresence = wavg(s => s.avgPresence)
  const avgDensity  = wavg(s => s.avgDensity)
  const avgPulse    = wavg(s => s.avgPulse)

  // Global averages (what an "average" organism would have)
  // These are calibrated defaults — adjust over time with real data
  const GLOBAL_AVG = {
    bounce:   0.45,
    swing:    0.57,
    presence: 0.35,
    density:  0.50,
    pulse:    95,
  }

  // Bias = user's average - global average
  // Clamped to bias range
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v))

  const bounceBias   = clamp(avgBounce   - GLOBAL_AVG.bounce,   -0.3,  0.3)
  const swingBias    = clamp(avgSwing    - GLOBAL_AVG.swing,    -0.1,  0.1)
  const presenceBias = clamp(avgPresence - GLOBAL_AVG.presence, -0.3,  0.3)
  const densityBias  = clamp(avgDensity  - GLOBAL_AVG.density,  -0.3,  0.3)
  const pulseBias    = clamp(avgPulse    - GLOBAL_AVG.pulse,    -15,   15)
  // Pocket tracks presence with slight lag
  const pocketBias   = clamp(presenceBias * 0.7, -0.3, 0.3)

  // Mode bias: how much more/less often did this user hit each mode?
  // Compared to a flat 20% distribution across 5 modes
  const modeFreq: Record<string, number> = {}
  for (const mode of Object.values(OrganismMode)) modeFreq[mode] = 0

  for (let i = 0; i < sessions.length; i++) {
    const dist = sessions[i].modeDistribution
    for (const [mode, pct] of Object.entries(dist)) {
      modeFreq[mode] = (modeFreq[mode] ?? 0) + pct * w[i]
    }
  }

  const FLAT_MODE_PCT = 1 / Object.values(OrganismMode).length   // 0.2
  const modeBias = Object.fromEntries(
    Object.values(OrganismMode).map(mode => [
      mode,
      clamp((modeFreq[mode] ?? 0) - FLAT_MODE_PCT, -0.2, 0.2),
    ])
  ) as Record<OrganismMode, number>

  // Confidence: saturates at 20 sessions
  const confidence = Math.min(1, sessions.length / 20)

  return {
    userId,
    computedAt:   Date.now(),
    sessionCount: sessions.length,
    bounceBias,
    swingBias,
    pocketBias,
    presenceBias,
    densityBias,
    pulseBias,
    modeBias,
    confidence,
  }
}
