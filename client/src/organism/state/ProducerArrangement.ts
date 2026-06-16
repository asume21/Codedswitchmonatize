import type { ArrangementSection } from './MusicalState'
import type { ArrangementSection as PlanSection } from '@shared/arrangement'

export interface ProducerArrangementSlot {
  name: ArrangementSection
  bars: number
  drums: number
  bass: number
  melody: number
  chord: number
  texture: number
  energy: number
  drumDropout: boolean
  bassDropout: boolean
  melodyDropout: boolean
}

// Producer-grade 18-bar beat form shared by the director and the audio
// multipliers. Keeping this in one place prevents UI state and audible state
// from drifting apart.
//
// Shortened from the old 64-bar arrangement. Original cycled in ~3 minutes
// at 80 BPM, which meant listeners gave up before the song "moved." This
// 18-bar form cycles in ~54s at 80 BPM, ~30s at 140 BPM. First drop hits
// at bar 6 (~13s at 80 BPM, ~7s at 140 BPM) — much tighter for live audition.
// Patterns still vary across cycles because director.variantIndex keeps
// incrementing per section, and the Conductor picks a new progression on
// each section change.
// Each section has a clear musical INTENT — not just "everything quieter."
// The multipliers ENFORCE that intent through arrangement gain scaling:
//
//   intro     — chords + melody + bass set the mood, drums tucked low
//   verse     — drums drop, full band, melody settles back a notch
//   build     — tension: melody climbs, drums tighten, hats subdivide
//   drop      — full force: everything at max, melody hook prominent
//   breakdown — drums tuck down, sparse harmony, gives the next drop weight
//   drop2     — return to drop energy with the melody pushed harder
//
// drumDropout=true means the slot WANTS zero drums. In live audition mode that
// reads as playback failure, so song-form templates prefer low drum beds over
// hard dropouts.

// ── Template bank ────────────────────────────────────────────────────
// 5 different arrangement templates. The Organism picks one at random on
// each cold-start so the same preset doesn't always produce the same
// structural form. Composer can also override by writing template id into
// the plan (future).

const TEMPLATE_CLASSIC: ProducerArrangementSlot[] = [
  // Classic verse-chorus pop/hip-hop form. Drum intro, satisfying drop.
  { name: 'intro',     bars: 2, drums: 0.28, bass: 0.85, melody: 0.95, chord: 0.95, texture: 0, energy: 0.35, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.85, bass: 0.95, melody: 0.85, chord: 0.75, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 2, drums: 0.95, bass: 0.95, melody: 1.00, chord: 0.80, texture: 0, energy: 0.82, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.25, bass: 0.45, melody: 0.85, chord: 0.95, texture: 0, energy: 0.45, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.90, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_DROPFIRST: ProducerArrangementSlot[] = [
  // Hook-first: the drop opens the song. Common in modern trap/club.
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.70, bass: 0.90, melody: 0.80, chord: 0.72, texture: 0, energy: 0.55, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.25, bass: 0.40, melody: 0.90, chord: 0.95, texture: 0, energy: 0.40, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 2, drums: 0.92, bass: 0.95, melody: 1.00, chord: 0.80, texture: 0, energy: 0.85, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.90, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_LOFI_LOOP: ProducerArrangementSlot[] = [
  // Lo-fi loop — no big drops, just gentle ebb and flow. For chill sessions.
  { name: 'intro',     bars: 2, drums: 0.24, bass: 0.70, melody: 0.85, chord: 0.95, texture: 0, energy: 0.25, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 6, drums: 0.70, bass: 0.85, melody: 0.80, chord: 0.80, texture: 0, energy: 0.50, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.35, bass: 0.55, melody: 0.95, chord: 0.95, texture: 0, energy: 0.40, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 6, drums: 0.78, bass: 0.90, melody: 0.85, chord: 0.78, texture: 0, energy: 0.58, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'outro',     bars: 2, drums: 0.40, bass: 0.55, melody: 0.75, chord: 0.85, texture: 0, energy: 0.30, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_DJ_BUILD: ProducerArrangementSlot[] = [
  // DJ-style — long build into one massive drop, then breakdown and reprise.
  { name: 'intro',     bars: 2, drums: 0.22, bass: 0.30, melody: 0.85, chord: 0.95, texture: 0, energy: 0.25, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 4, drums: 0.85, bass: 0.85, melody: 1.00, chord: 0.85, texture: 0, energy: 0.78, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 6, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.24, bass: 0.30, melody: 0.95, chord: 1.00, texture: 0, energy: 0.40, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.90, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_HOOK_HEAVY: ProducerArrangementSlot[] = [
  // Hook-heavy — short verses with the chorus/drop hitting frequently.
  { name: 'intro',     bars: 2, drums: 0.28, bass: 0.85, melody: 0.95, chord: 0.90, texture: 0, energy: 0.30, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.80, bass: 0.92, melody: 0.85, chord: 0.75, texture: 0, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.82, bass: 0.94, melody: 0.88, chord: 0.78, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.90, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_STORYTELLING: ProducerArrangementSlot[] = [
  // Storytelling — sparse hooks, long verses, voice-forward. Drums steady
  // but melody recedes during the verses to give the rapper room.
  { name: 'intro',     bars: 2, drums: 0.22, bass: 0.55, melody: 0.85, chord: 0.95, texture: 0, energy: 0.25, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 8, drums: 0.75, bass: 0.90, melody: 0.50, chord: 0.80, texture: 0, energy: 0.55, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 0.95, bass: 1.00, melody: 1.00, chord: 0.85, texture: 0, energy: 0.85, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 8, drums: 0.78, bass: 0.92, melody: 0.55, chord: 0.82, texture: 0, energy: 0.58, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'outro',     bars: 2, drums: 0.30, bass: 0.55, melody: 0.70, chord: 0.85, texture: 0, energy: 0.30, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_CYPHER_FLOW: ProducerArrangementSlot[] = [
  // Cypher flow — just drums + bass loop forever. No drop, no breakdown.
  // The rapper IS the arrangement. Melody/chord stay quiet throughout.
  { name: 'verse',     bars: 4, drums: 0.90, bass: 0.95, melody: 0.30, chord: 0.45, texture: 0, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.92, bass: 0.97, melody: 0.32, chord: 0.45, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.94, bass: 0.97, melody: 0.30, chord: 0.45, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_SLOW_BURN: ProducerArrangementSlot[] = [
  // Slow burn — extra-long intro, gradual build, payoff lands hard at the end.
  { name: 'intro',     bars: 4, drums: 0.20, bass: 0.40, melody: 0.80, chord: 0.95, texture: 0, energy: 0.20, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.60, bass: 0.80, melody: 0.85, chord: 0.85, texture: 0, energy: 0.50, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 4, drums: 0.85, bass: 0.92, melody: 1.00, chord: 0.85, texture: 0, energy: 0.78, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 6, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.90, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_TRAP_TAG: ProducerArrangementSlot[] = [
  // Trap tag-team — two short verses before a big drop, mimicking a
  // feature/collab structure (Verse 1 → Verse 2 → Hook).
  { name: 'intro',     bars: 2, drums: 0.28, bass: 0.85, melody: 0.95, chord: 0.92, texture: 0, energy: 0.32, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.85, bass: 0.95, melody: 0.75, chord: 0.78, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.88, bass: 0.97, melody: 0.78, chord: 0.78, texture: 0, energy: 0.65, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.25, bass: 0.45, melody: 0.90, chord: 0.95, texture: 0, energy: 0.42, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.90, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_BRIDGE_HEAVY: ProducerArrangementSlot[] = [
  // Bridge-heavy — long developmental section in the middle. Classic
  // pop/rock form where the bridge reframes the song before the final hook.
  { name: 'intro',     bars: 2, drums: 0.26, bass: 0.80, melody: 0.95, chord: 0.95, texture: 0, energy: 0.32, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.80, bass: 0.92, melody: 0.85, chord: 0.78, texture: 0, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 6, drums: 0.40, bass: 0.65, melody: 1.00, chord: 1.00, texture: 0, energy: 0.55, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.92, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_BACK_AND_FORTH: ProducerArrangementSlot[] = [
  // Back-and-forth — ping-pong between verse and drop, no breakdown.
  // Keeps energy high but trades textures rapidly.
  { name: 'verse',     bars: 2, drums: 0.78, bass: 0.92, melody: 0.85, chord: 0.78, texture: 0, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.80, bass: 0.94, melody: 0.88, chord: 0.78, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.00, melody: 1.05, chord: 0.85, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.82, bass: 0.94, melody: 0.88, chord: 0.78, texture: 0, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.00, melody: 1.10, chord: 0.90, texture: 0, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_MINIMAL_JAM: ProducerArrangementSlot[] = [
  // Minimal jam — one section that loops, perfect for sustained freestyling
  // or beat-driven practice. Drums + bass + sparse chord/melody, no drama.
  { name: 'verse',     bars: 4, drums: 0.85, bass: 0.95, melody: 0.65, chord: 0.70, texture: 0, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.85, bass: 0.95, melody: 0.65, chord: 0.70, texture: 0, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
]

export interface ArrangementTemplate {
  id:     string
  label:  string
  slots:  ProducerArrangementSlot[]
}

// Templates are pure data here — no fitsMood / fitsEnergy. The composer
// (server) owns all "which template fits which song" decisions; this file
// just exposes the audio multipliers per slot. See
// shared/arrangementTemplates.ts for the catalog the composer reads.
export const ARRANGEMENT_TEMPLATES: ReadonlyArray<ArrangementTemplate> = [
  { id: 'classic',        label: 'Classic',         slots: TEMPLATE_CLASSIC },
  { id: 'dropfirst',      label: 'Drop First',      slots: TEMPLATE_DROPFIRST },
  { id: 'lofi-loop',      label: 'Lo-fi Loop',      slots: TEMPLATE_LOFI_LOOP },
  { id: 'dj-build',       label: 'DJ Build & Drop', slots: TEMPLATE_DJ_BUILD },
  { id: 'hook-heavy',     label: 'Hook Heavy',      slots: TEMPLATE_HOOK_HEAVY },
  { id: 'storytelling',   label: 'Storytelling',    slots: TEMPLATE_STORYTELLING },
  { id: 'cypher-flow',    label: 'Cypher Flow',     slots: TEMPLATE_CYPHER_FLOW },
  { id: 'slow-burn',      label: 'Slow Burn',       slots: TEMPLATE_SLOW_BURN },
  { id: 'trap-tag',       label: 'Trap Tag-Team',   slots: TEMPLATE_TRAP_TAG },
  { id: 'bridge-heavy',   label: 'Bridge Heavy',    slots: TEMPLATE_BRIDGE_HEAVY },
  { id: 'back-and-forth', label: 'Back & Forth',    slots: TEMPLATE_BACK_AND_FORTH },
  { id: 'minimal-jam',    label: 'Minimal Jam',     slots: TEMPLATE_MINIMAL_JAM },
]

const TEMPLATES_BY_ID = new Map(ARRANGEMENT_TEMPLATES.map(t => [t.id, t]))

// ── Active template ──────────────────────────────────────────────────
// The currently-active arrangement template. Mutated by
// setActiveArrangementTemplate() — called from OrganismProvider.quickStart
// with a random pick from the active preset's `arrangementTemplateIds`.
// All consumers (GeneratorOrchestrator, MusicalDirector) read through
// the getProducer* functions below so they always see live state.

let currentTemplateId: string = 'classic'
let currentSlots:      ProducerArrangementSlot[] = TEMPLATE_CLASSIC
let currentTotalBars:  number = TEMPLATE_CLASSIC.reduce((sum, s) => sum + s.bars, 0)

// ── Plan override (Phase 5: ArrangementPlan) ──────────────────────────
// When the Conductor loads a composer ArrangementPlan, the plan's own
// sections — not a named template — become the live arrangement. This keeps
// the section boundaries the live band plays (durations from
// plan.sections[].bars) in lockstep with the progressions the Conductor
// loads per section, AND with what ACE-Step renders from the same plan's
// acePrompt. Null = jam mode / template mode (the named-template path above).
let planSlots:     ProducerArrangementSlot[] | null = null
let planTotalBars: number = 0

/**
 * Switch to a different arrangement template. Called by OrganismProvider on
 * preset start with a random pick from the preset's `arrangementTemplateIds`.
 * Returns true if the id is known and the swap took effect.
 */
export function setActiveArrangementTemplate(id: string): boolean {
  const template = TEMPLATES_BY_ID.get(id)
  if (!template) return false
  if (currentTemplateId === id) return true
  currentTemplateId = id
  currentSlots      = template.slots
  currentTotalBars  = template.slots.reduce((sum, s) => sum + s.bars, 0)
  return true
}

/** The currently-active template id (for debug and UI). */
export function getActiveArrangementTemplateId(): string {
  return currentTemplateId
}

/** Total bars in the active arrangement cycle — plan override when one is
 *  loaded, otherwise the active named template. */
export function getProducerArrangementTotalBars(): number {
  return planSlots ? planTotalBars : currentTotalBars
}


export function getProducerArrangementSlot(barNumber: number): {
  slot: ProducerArrangementSlot
  cycleBar: number
  sectionBar: number
} {
  const slots = planSlots ?? currentSlots
  const totalBars = planSlots ? planTotalBars : currentTotalBars
  const safeBar = Math.max(0, Math.floor(Number.isFinite(barNumber) ? barNumber : 0))
  const cycleBar = safeBar % totalBars
  let accumulated = 0
  for (const slot of slots) {
    if (cycleBar < accumulated + slot.bars) {
      return { slot, cycleBar, sectionBar: cycleBar - accumulated }
    }
    accumulated += slot.bars
  }
  return { slot: slots[0], cycleBar: 0, sectionBar: 0 }
}

// ── Plan → arrangement conversion (Phase 5) ───────────────────────────
//
// A composer's ArrangementSection carries musical INTENT (energy, density)
// but not the five per-channel gain multipliers the audio engine needs. This
// derives them from energy + density using the relationships read off the
// 12 hand-tuned templates above:
//   - drums track DENSITY most directly (sparse intro → busy drop).
//   - bass + melody lift with ENERGY but never silence (audible bed always).
//   - chords recede as energy rises so drums/bass own the drop, and carry
//     the low-energy sections (intro/breakdown) where they're exposed.
//   - texture stays off — it's gated separately by the orchestrator's
//     textureEnabled switch (off by default for hip-hop).
//
// These coefficients are the one genuinely musical knob in the plan→audio
// path; tune them by ear, not by type-checker. The mapping is intentionally
// lossy (a "voice-forward" verse can't be expressed by energy/density alone —
// that intent rides on the section's StylePreset instead).
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const round2  = (v: number) => Math.round(v * 100) / 100

export function slotFromPlanSection(section: PlanSection): ProducerArrangementSlot {
  const energy  = clamp01(Number.isFinite(section.energy) ? section.energy : 0.5)
  const density = clamp01(Number.isFinite(section.density) ? section.density : 0.5)
  const bars    = Math.min(64, Math.max(1, Math.round(section.bars)))
  return {
    name:          section.name,
    bars,
    drums:         round2(0.25 + density * 0.80),
    bass:          round2(0.45 + energy  * 0.55),
    melody:        round2(0.80 + energy  * 0.28),
    chord:         round2(0.65 + (1 - energy) * 0.30),
    texture:       0,
    energy,
    drumDropout:   false,
    bassDropout:   false,
    melodyDropout: false,
  }
}

/**
 * Install a composer plan's sections as the live arrangement. The plan's bar
 * counts become the section durations; energy/density become channel
 * multipliers via slotFromPlanSection. No-op on an empty list so a malformed
 * plan leaves the active template playing. Reverted by clearArrangementFromPlan.
 */
export function setArrangementFromPlan(sections: ReadonlyArray<PlanSection>): boolean {
  if (!sections || sections.length === 0) return false
  planSlots     = sections.map(slotFromPlanSection)
  planTotalBars = planSlots.reduce((sum, s) => sum + s.bars, 0)
  return true
}

/** Drop the plan override and return to the active named template. */
export function clearArrangementFromPlan(): void {
  planSlots     = null
  planTotalBars = 0
}

// Deprecated const exports — kept for backward compat with old call sites
// that still import them. Always reflect the CLASSIC template's bar count
// (the only safe constant — actual cycle length is template-dependent).
// New code should call getProducerArrangementTotalBars() instead.
export const PRODUCER_ARRANGEMENT: ProducerArrangementSlot[] = currentSlots
export const PRODUCER_ARRANGEMENT_TOTAL_BARS: number = currentTotalBars
