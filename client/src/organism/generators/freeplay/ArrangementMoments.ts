export type ArrangementMomentSectionName =
  | 'intro'
  | 'verse'
  | 'build'
  | 'drop'
  | 'drop2'
  | 'breakdown'
  | 'bridge'
  | 'outro'
  | string

export interface ArrangementMomentSection {
  name: ArrangementMomentSectionName
  bars: number
  energy: number
  drums: number
  bass: number
  melody: number
  chord: number
  texture: number
}

export interface ArrangementMomentContext {
  current: ArrangementMomentSection
  next: ArrangementMomentSection
  sectionBar: number
  barNumber: number
  cycleBar: number
  arrangementEnabled: boolean
  melodyOnlyMode: boolean
  drumEnabled: boolean
}

export interface PreDropMomentPlan {
  shouldFire: boolean
  breakStartTime: string | null
  breakEndTime: string | null
  bassDuck: number
  melodyDuck: number
  chordDuck: number
  triggerFill: boolean
  negativeSpace: 'none' | 'bass-only' | 'rhythm-section'
  reason: string
}

export interface DropEntryBoostPlan {
  shouldBoost: boolean
  kickMultiplier: number
  hatMultiplier: number
  settleBars: number
  impactVelocity: number
  reason: string
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function isDropName(name: string): boolean {
  return name === 'drop' || name === 'drop2'
}

function isBuildLike(name: string): boolean {
  return name === 'build' || name === 'breakdown' || name === 'bridge'
}

export function isEnergyLiftIntoDrop(current: ArrangementMomentSection, next: ArrangementMomentSection): boolean {
  const currentEnergy = clamp01(current.energy)
  const nextEnergy = clamp01(next.energy)
  return isDropName(next.name) && nextEnergy >= 0.9 && nextEnergy > currentEnergy + 0.05
}

export function planPreDropMoment(ctx: ArrangementMomentContext): PreDropMomentPlan {
  if (!ctx.arrangementEnabled) {
    return noPreDrop('arrangement-disabled')
  }
  if (ctx.melodyOnlyMode) {
    return noPreDrop('melody-only')
  }
  if (!ctx.drumEnabled) {
    return noPreDrop('drums-disabled')
  }
  if (ctx.sectionBar !== ctx.current.bars - 1) {
    return noPreDrop('not-final-section-bar')
  }
  if (!isEnergyLiftIntoDrop(ctx.current, ctx.next)) {
    return noPreDrop('not-lift-into-drop')
  }

  const wantsStrongerNegativeSpace = isBuildLike(ctx.current.name)
  const breakStartTime = `${ctx.barNumber}:2:0`
  const breakEndTime = `${ctx.barNumber + 1}:0:0`

  return {
    shouldFire: true,
    breakStartTime,
    breakEndTime,
    bassDuck: 0,
    // Keep melody/chords present by default; only build-like sections tuck them
    // slightly so the drop feels bigger without sounding like playback failed.
    melodyDuck: wantsStrongerNegativeSpace ? 0.72 : ctx.current.melody,
    chordDuck: wantsStrongerNegativeSpace ? 0.78 : ctx.current.chord,
    triggerFill: true,
    negativeSpace: wantsStrongerNegativeSpace ? 'rhythm-section' : 'bass-only',
    reason: wantsStrongerNegativeSpace ? 'build-like-lift-into-drop' : 'lift-into-drop',
  }
}

export function planDropEntryBoost(section: ArrangementMomentSection, sectionBar: number): DropEntryBoostPlan {
  if (!isDropName(section.name) || sectionBar !== 0) {
    return {
      shouldBoost: false,
      kickMultiplier: 1,
      hatMultiplier: 1,
      settleBars: 0,
      impactVelocity: 0,
      reason: 'not-drop-entry',
    }
  }

  const dropEnergy = clamp01(section.energy)
  return {
    shouldBoost: true,
    // Conservative one-bar excitement. These are multipliers on top of the
    // existing user/base values, not permanent fader moves.
    kickMultiplier: 1.08 + dropEnergy * 0.12,
    hatMultiplier: 1.06 + dropEnergy * 0.14,
    settleBars: 1,
    impactVelocity: section.name === 'drop2' ? 0.9 : 1.0,
    reason: section.name === 'drop2' ? 'drop2-entry' : 'drop-entry',
  }
}

function noPreDrop(reason: string): PreDropMomentPlan {
  return {
    shouldFire: false,
    breakStartTime: null,
    breakEndTime: null,
    bassDuck: 1,
    melodyDuck: 1,
    chordDuck: 1,
    triggerFill: false,
    negativeSpace: 'none',
    reason,
  }
}
