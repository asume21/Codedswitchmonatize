import { v4 as uuidv4 }         from 'uuid'
import type {
  SessionDNA,
  PhysicsSnapshot,
  StateSnapshot,
  TransitionSnapshot,
  GeneratorEvent,
}                                from './types'
import { OrganismMode }          from '../physics/types'
import { OState }                from '../state/types'

export function buildSessionDNA(
  userId: string,
  data: {
    physicsTimeline:  PhysicsSnapshot[]
    stateTimeline:    StateSnapshot[]
    generatorEvents:  GeneratorEvent[]
    transitions:      TransitionSnapshot[]
    sessionStartMs:   number
    currentMs:        number
  }
): SessionDNA {
  const {
    physicsTimeline, stateTimeline,
    generatorEvents, transitions,
    sessionStartMs, currentMs,
  } = data

  const durationMs = currentMs - sessionStartMs

  // ── Mode distribution ──────────────────────────────────────────────
  const modeCount: Record<string, number> = {}
  for (const snap of physicsTimeline) {
    modeCount[snap.mode] = (modeCount[snap.mode] ?? 0) + 1
  }
  const total = physicsTimeline.length || 1
  const modeDistribution = Object.fromEntries(
    Object.values(OrganismMode).map(m => [m, (modeCount[m] ?? 0) / total])
  ) as Record<OrganismMode, number>

  const dominantMode = (Object.entries(modeDistribution)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? OrganismMode.Glow) as OrganismMode

  // ── Pulse stats ───────────────────────────────────────────────────
  const pulses     = physicsTimeline.map(s => s.pulse)
  const avgPulse   = mean(pulses)
  const pulseRange: [number, number] = pulses.length > 0
    ? [Math.min(...pulses), Math.max(...pulses)]
    : [0, 0]

  // ── Physics averages ──────────────────────────────────────────────
  const avgBounce   = mean(physicsTimeline.map(s => s.bounce))
  const avgSwing    = mean(physicsTimeline.map(s => s.swing))
  const avgPresence = mean(physicsTimeline.map(s => s.presence))
  const avgDensity  = mean(physicsTimeline.map(s => s.density))

  // ── Flow metrics ──────────────────────────────────────────────────
  const flowSnaps         = stateTimeline.filter(s => s.state === OState.Flow)
  const timeInFlowMs      = (flowSnaps.length / total) * durationMs
  const flowPercentage    = durationMs > 0 ? timeInFlowMs / durationMs : 0
  const longestFlowStreak = computeLongestStreak(stateTimeline, OState.Flow)
  const transitionCount   = transitions.length
  const cadenceLockEvents = transitions.filter(t => t.to === OState.Flow).length

  // ── Voice fingerprint ─────────────────────────────────────────────
  const avgSyllabicDensity  = mean(
    stateTimeline.filter(s => s.syllabicDensity > 0).map(s => s.syllabicDensity)
  )

  const pitches   = generatorEvents
    .filter(e => e.pitch !== undefined)
    .map(e => e.pitch!)
  const pitchCenter = median(pitches) || 0

  const energyProfile =
    avgPresence > 0.7 ? 'hot'  :
    avgPresence > 0.4 ? 'warm' :
    avgPresence > 0.2 ? 'cool' : 'cold'

  return {
    sessionId:   uuidv4(),
    userId,
    createdAt:   Date.now(),
    durationMs,
    dominantMode,
    modeDistribution,
    avgPulse,
    pulseRange,
    avgBounce,
    avgSwing,
    avgPresence,
    avgDensity,
    timeInFlowMs,
    flowPercentage,
    longestFlowStreak,
    transitionCount,
    cadenceLockEvents,
    avgSyllabicDensity,
    pitchCenter,
    energyProfile,
    physicsTimeline,
    stateTimeline,
    transitions,
    generatorEvents,
  }
}

// ── Utilities ──────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function computeLongestStreak(
  timeline: { state: string }[],
  targetState: string
): number {
  let longest = 0
  let current = 0
  const sampleIntervalMs = 1000 / 4.3  // ~233ms per sample at 10-frame rate

  for (const snap of timeline) {
    if (snap.state === targetState) {
      current += sampleIntervalMs
      if (current > longest) longest = current
    } else {
      current = 0
    }
  }
  return longest
}
