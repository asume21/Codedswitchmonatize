type AceSubGenre = 'trap' | 'boom-bap' | 'drill' | 'r&b-soul' | 'afrobeats'
type AceGroove = 'straight' | 'swing' | 'triplet'
type MelodyBehavior = 'lead' | 'hint' | 'rest'
type ChordTechnique = 'pad' | 'rolled' | 'stab'

export interface AceSectionDirective {
  section: string
  energy: number
  subGenre: AceSubGenre
  groove: AceGroove
  drums: { kick: number; hat: number; arrangement: number }
  bass: { volume: number }
  melody: {
    volume: number
    behavior: MelodyBehavior
    chordTechnique: ChordTechnique
  }
  reasoning: string
}

interface GenerateNextSectionInput {
  currentSection: string
  energy?: number
  subGenre?: string
  bpm?: number
  barInCycle?: number
  totalBars?: number
  cycleCount?: number
}

const SECTION_BLUEPRINTS: Record<string, Partial<AceSectionDirective>> = {
  intro:     { energy: 0.30, drums: { kick: 0.55, hat: 0.32, arrangement: 0.55 }, bass: { volume: 0.65 }, melody: { volume: 0.45, behavior: 'hint', chordTechnique: 'pad' } },
  verse:     { energy: 0.50, drums: { kick: 0.75, hat: 0.60, arrangement: 0.75 }, bass: { volume: 0.92 }, melody: { volume: 0.50, behavior: 'hint', chordTechnique: 'rolled' } },
  build:     { energy: 0.75, drums: { kick: 0.88, hat: 0.80, arrangement: 0.88 }, bass: { volume: 0.95 }, melody: { volume: 0.82, behavior: 'hint', chordTechnique: 'rolled' } },
  drop:      { energy: 1.00, drums: { kick: 1.00, hat: 1.00, arrangement: 1.00 }, bass: { volume: 0.95 }, melody: { volume: 1.00, behavior: 'lead', chordTechnique: 'stab' } },
  drop2:     { energy: 1.00, drums: { kick: 1.00, hat: 1.00, arrangement: 1.00 }, bass: { volume: 0.98 }, melody: { volume: 1.00, behavior: 'lead', chordTechnique: 'stab' } },
  hook:      { energy: 0.95, drums: { kick: 0.95, hat: 0.92, arrangement: 0.95 }, bass: { volume: 0.92 }, melody: { volume: 0.95, behavior: 'lead', chordTechnique: 'stab' } },
  breakdown: { energy: 0.35, drums: { kick: 0.42, hat: 0.28, arrangement: 0.42 }, bass: { volume: 0.68 }, melody: { volume: 0.42, behavior: 'hint', chordTechnique: 'pad' } },
}

const SUBGENRE_GROOVE: Record<AceSubGenre, AceGroove> = {
  trap: 'triplet',
  'boom-bap': 'swing',
  drill: 'triplet',
  'r&b-soul': 'swing',
  afrobeats: 'straight',
}

const SUBGENRE_ADJUSTMENTS: Record<AceSubGenre, {
  kick: number
  hat: number
  bass: number
  melody: number
}> = {
  trap: { kick: 0.04, hat: 0.08, bass: 0.04, melody: -0.02 },
  'boom-bap': { kick: 0.02, hat: -0.08, bass: -0.04, melody: 0.00 },
  drill: { kick: -0.08, hat: 0.10, bass: 0.06, melody: -0.08 },
  'r&b-soul': { kick: -0.10, hat: -0.12, bass: 0.02, melody: 0.08 },
  afrobeats: { kick: -0.02, hat: 0.02, bass: -0.02, melody: 0.06 },
}

function clamp(v: unknown, def: number): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(1, v))
    : def
}

function normalizeSubGenre(value: string | undefined): AceSubGenre {
  const normalized = String(value ?? 'trap').trim().toLowerCase()
  if (normalized === 'boom bap') return 'boom-bap'
  if (normalized === 'rnb' || normalized === 'r&b' || normalized === 'soul') return 'r&b-soul'
  if (normalized === 'afrobeat') return 'afrobeats'
  if (['trap', 'boom-bap', 'drill', 'r&b-soul', 'afrobeats'].includes(normalized)) {
    return normalized as AceSubGenre
  }
  return 'trap'
}

function normalizeSection(value: string): string {
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : 'verse'
}

function withAdjustment(value: number | undefined, adjustment: number, fallback: number): number {
  return clamp((value ?? fallback) + adjustment, fallback)
}

export const aceEngine = {
  async generateNextSection(input: GenerateNextSectionInput): Promise<AceSectionDirective> {
    const section = normalizeSection(input.currentSection)
    const subGenre = normalizeSubGenre(input.subGenre)
    const blueprint = SECTION_BLUEPRINTS[section] ?? SECTION_BLUEPRINTS.verse
    const adjustments = SUBGENRE_ADJUSTMENTS[subGenre]
    const baseEnergy = clamp(blueprint.energy, 0.7)
    const requestedEnergy = clamp(input.energy, baseEnergy)
    const energy = clamp((baseEnergy * 0.7) + (requestedEnergy * 0.3), baseEnergy)
    const drums = blueprint.drums ?? SECTION_BLUEPRINTS.verse.drums!
    const bass = blueprint.bass ?? SECTION_BLUEPRINTS.verse.bass!
    const melody = blueprint.melody ?? SECTION_BLUEPRINTS.verse.melody!

    return {
      section,
      energy,
      subGenre,
      groove: SUBGENRE_GROOVE[subGenre],
      drums: {
        kick: withAdjustment(drums.kick, adjustments.kick, 0.75),
        hat: withAdjustment(drums.hat, adjustments.hat, 0.65),
        arrangement: clamp(drums.arrangement, energy),
      },
      bass: {
        volume: withAdjustment(bass.volume, adjustments.bass, 0.8),
      },
      melody: {
        volume: withAdjustment(melody.volume, adjustments.melody, 0.6),
        behavior: melody.behavior ?? 'hint',
        chordTechnique: melody.chordTechnique ?? 'rolled',
      },
      reasoning: `ACE local composition selected ${section} energy for ${subGenre}.`,
    }
  },
}
