import type { ArrangementSection } from './MusicalState'
import type { ArrangementSection as PlanSection, SectionOrchestration } from '@shared/arrangement'

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
  /** Composer's per-instrument roles for this section (plan mode only).
   *  Absent in jam mode / template slots → orchestrator defaults to 'support'. */
  orchestration?: SectionOrchestration
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

// ── Section dynamics (rewritten 2026-07-11, "lock the loop") ─────────
//
// NOTE ON `bars`: these are TEMPLATE bars, multiplied by SECTION_LENGTH_SCALE
// (=4) below. `bars: 2` really plays 8 bars; `bars: 4` really plays 16. The
// lengths are already right — do not "fix" them.
//
// What was wrong was the DYNAMICS. Every slot carried `drumDropout: false` and
// an identical `texture: 0.4`, and the part multipliers all sat inside a narrow
// 0.7-1.1 band — a ~2 dB spread, which is inaudible. So every section played
// the same thing at the same volume, and the arrangement did nothing.
//
// The comment above admits why the dropouts were disabled: a hard dropout
// "reads as playback failure" in a live demo. True — but the cost was that
// NOTHING ever dropped out, and dropping a part is the single most powerful
// arrangement move there is. The breakdown now genuinely kills the drums, with
// chords/pads/melody carrying it loudly, immediately before the drop. That is
// unmistakably musical, not broken.
//
// VOCAL SPACE: the user is a freestyle rapper. In a VERSE his voice IS the
// melody, so the lead pulls back to ~0.35 and the chords to ~0.5 — drums and
// bass carry it, and the center is left open. The HOOK is where the melody
// comes back up and takes the tune over. That is the "center open for vocal"
// sound profile expressed as arrangement instead of EQ.

const TEMPLATE_CLASSIC: ProducerArrangementSlot[] = [
  // Classic verse-hook form.
  { name: 'intro',     bars: 2, drums: 0.30, bass: 0.60, melody: 0.70, chord: 0.90, texture: 0.85, energy: 0.30, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.95, bass: 1.00, melody: 0.35, chord: 0.50, texture: 0.35, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 2, drums: 1.00, bass: 1.00, melody: 0.85, chord: 0.75, texture: 0.70, energy: 0.85, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  // THE MOVE: the beat drops out. Pads and melody hold the room, and the drop
  // that follows lands twice as hard for it.
  { name: 'breakdown', bars: 2, drums: 0.00, bass: 0.50, melody: 0.95, chord: 1.05, texture: 1.00, energy: 0.40, drumDropout: true,  bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.05, melody: 1.15, chord: 1.00, texture: 0.95, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_DROPFIRST: ProducerArrangementSlot[] = [
  // Hook-first: the drop opens the song. Common in modern trap/club.
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.90, bass: 1.00, melody: 0.35, chord: 0.50, texture: 0.35, energy: 0.55, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.00, bass: 0.45, melody: 1.00, chord: 1.05, texture: 1.00, energy: 0.40, drumDropout: true,  bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 2, drums: 1.00, bass: 1.00, melody: 0.90, chord: 0.75, texture: 0.70, energy: 0.88, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.05, melody: 1.15, chord: 1.00, texture: 0.95, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_LOFI_LOOP: ProducerArrangementSlot[] = [
  // Lo-fi — gentle ebb and flow, no hard dropouts. The pads ARE the color here,
  // so texture stays forward throughout.
  { name: 'intro',     bars: 2, drums: 0.25, bass: 0.65, melody: 0.70, chord: 0.95, texture: 0.90, energy: 0.25, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 6, drums: 0.80, bass: 0.95, melody: 0.40, chord: 0.60, texture: 0.60, energy: 0.50, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.20, bass: 0.55, melody: 0.95, chord: 1.00, texture: 1.00, energy: 0.38, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 6, drums: 0.88, bass: 1.00, melody: 0.45, chord: 0.62, texture: 0.60, energy: 0.58, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'outro',     bars: 2, drums: 0.35, bass: 0.55, melody: 0.80, chord: 0.90, texture: 0.95, energy: 0.28, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_DJ_BUILD: ProducerArrangementSlot[] = [
  // DJ-style — long build into one massive drop, then breakdown and reprise.
  { name: 'intro',     bars: 2, drums: 0.22, bass: 0.35, melody: 0.70, chord: 0.95, texture: 0.90, energy: 0.25, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 4, drums: 0.90, bass: 0.90, melody: 0.85, chord: 0.75, texture: 0.75, energy: 0.80, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 6, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.00, bass: 0.35, melody: 1.00, chord: 1.05, texture: 1.00, energy: 0.38, drumDropout: true,  bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.05, melody: 1.15, chord: 1.00, texture: 0.95, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_HOOK_HEAVY: ProducerArrangementSlot[] = [
  // Hook-heavy — the hook comes back often. Verses stay vocal-forward.
  { name: 'intro',     bars: 2, drums: 0.30, bass: 0.70, melody: 0.70, chord: 0.90, texture: 0.85, energy: 0.30, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.92, bass: 1.00, melody: 0.35, chord: 0.50, texture: 0.35, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.95, bass: 1.00, melody: 0.38, chord: 0.52, texture: 0.35, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.05, melody: 1.15, chord: 1.00, texture: 0.95, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_STORYTELLING: ProducerArrangementSlot[] = [
  // Storytelling — long verses, voice-forward. The melody gets out of the way
  // almost entirely during verses; the hook is where it speaks.
  { name: 'intro',     bars: 2, drums: 0.22, bass: 0.55, melody: 0.65, chord: 0.95, texture: 0.90, energy: 0.25, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 8, drums: 0.85, bass: 0.95, melody: 0.30, chord: 0.50, texture: 0.35, energy: 0.55, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.05, chord: 1.00, texture: 0.85, energy: 0.90, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 8, drums: 0.88, bass: 0.98, melody: 0.32, chord: 0.52, texture: 0.35, energy: 0.58, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'outro',     bars: 2, drums: 0.30, bass: 0.55, melody: 0.75, chord: 0.90, texture: 0.95, energy: 0.28, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_CYPHER_FLOW: ProducerArrangementSlot[] = [
  // Cypher flow — drums + bass, and that is the whole beat. No drop, no
  // breakdown. The RAPPER is the arrangement. Everything else stays out of the
  // way; the only movement is a slow lift in drum energy across the sections.
  { name: 'verse',     bars: 4, drums: 0.90, bass: 0.95, melody: 0.25, chord: 0.40, texture: 0.25, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.95, bass: 1.00, melody: 0.28, chord: 0.42, texture: 0.25, energy: 0.64, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 1.00, bass: 1.02, melody: 0.25, chord: 0.40, texture: 0.25, energy: 0.68, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_SLOW_BURN: ProducerArrangementSlot[] = [
  // Slow burn — long intro, gradual build, payoff lands hard and stays.
  { name: 'intro',     bars: 4, drums: 0.20, bass: 0.40, melody: 0.65, chord: 0.95, texture: 0.95, energy: 0.20, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.70, bass: 0.90, melody: 0.40, chord: 0.60, texture: 0.50, energy: 0.50, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'build',     bars: 4, drums: 0.92, bass: 0.95, melody: 0.85, chord: 0.80, texture: 0.75, energy: 0.80, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 6, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_TRAP_TAG: ProducerArrangementSlot[] = [
  // Trap tag-team — two verses before the hook, mimicking a feature/collab.
  { name: 'intro',     bars: 2, drums: 0.28, bass: 0.75, melody: 0.70, chord: 0.90, texture: 0.85, energy: 0.32, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.92, bass: 1.00, melody: 0.35, chord: 0.50, texture: 0.35, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.95, bass: 1.02, melody: 0.38, chord: 0.52, texture: 0.35, energy: 0.66, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 2, drums: 0.00, bass: 0.45, melody: 0.95, chord: 1.05, texture: 1.00, energy: 0.42, drumDropout: true,  bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.05, melody: 1.15, chord: 1.00, texture: 0.95, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_BRIDGE_HEAVY: ProducerArrangementSlot[] = [
  // Bridge-heavy — a long developmental middle that reframes the song. The
  // bridge pulls the BASS out rather than the drums, so it lifts instead of
  // stopping: same trick, different hole.
  { name: 'intro',     bars: 2, drums: 0.26, bass: 0.70, melody: 0.70, chord: 0.95, texture: 0.90, energy: 0.32, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.90, bass: 1.00, melody: 0.35, chord: 0.52, texture: 0.35, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'breakdown', bars: 6, drums: 0.55, bass: 0.00, melody: 1.05, chord: 1.05, texture: 1.00, energy: 0.55, drumDropout: false, bassDropout: true,  melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.05, melody: 1.15, chord: 1.00, texture: 0.95, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_BACK_AND_FORTH: ProducerArrangementSlot[] = [
  // Back-and-forth — ping-pong between verse and hook. Energy stays high; the
  // contrast is vocal-space vs melody-space rather than loud vs quiet.
  { name: 'verse',     bars: 2, drums: 0.90, bass: 1.00, melody: 0.35, chord: 0.50, texture: 0.35, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.92, bass: 1.00, melody: 0.38, chord: 0.52, texture: 0.35, energy: 0.62, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop',      bars: 4, drums: 1.00, bass: 1.05, melody: 1.10, chord: 1.00, texture: 0.90, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 2, drums: 0.95, bass: 1.02, melody: 0.38, chord: 0.52, texture: 0.35, energy: 0.64, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'drop2',     bars: 4, drums: 1.00, bass: 1.05, melody: 1.15, chord: 1.00, texture: 0.95, energy: 1.00, drumDropout: false, bassDropout: false, melodyDropout: false },
]

const TEMPLATE_MINIMAL_JAM: ProducerArrangementSlot[] = [
  // Minimal jam — one steady loop for sustained freestyling. No drama by
  // design: this is the practice form, and interruptions are the enemy.
  { name: 'verse',     bars: 4, drums: 0.90, bass: 1.00, melody: 0.45, chord: 0.60, texture: 0.40, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
  { name: 'verse',     bars: 4, drums: 0.90, bass: 1.00, melody: 0.45, chord: 0.60, texture: 0.40, energy: 0.60, drumDropout: false, bassDropout: false, melodyDropout: false },
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

// ── Section length scale ─────────────────────────────────────────────
// The named templates were tuned SHORT (2–6 bars/section) for snappy "live
// audition." In practice they changed too fast to ride: a 2-bar section is
// ~5s at 90 BPM and ~3.5s at 140 BPM, so the section flipped before a
// listener (or a freestyling rapper) could settle into it. This scale
// lengthens every template section so each one plays long enough to hear and
// perform over — a 2-bar intro becomes 4 bars, a 4-bar verse becomes 8.
//
// Plan-mode sections (composer ArrangementPlan / ACE-Step) are NOT scaled —
// their bar counts must stay in lockstep with the rendered audio. Only the
// named-template (jam mode) path below applies this.
//
// ×2 was still too fast: a 4-bar classic verse became 8 bars = ~13s at 140 BPM,
// not enough time for a freestyle rapper to settle in. ×3 makes the same verse
// 12 bars = ~21s at 140 BPM, ~32s at 90 BPM — closer to a real rap verse.
// Templates that already have 8-bar verses (storytelling, slow-burn) become
// 24 bars ≈ 43s at 90 BPM — plenty of room for extended freestyling.
const SECTION_LENGTH_SCALE: number = 4

function scaleSlots(slots: ProducerArrangementSlot[]): ProducerArrangementSlot[] {
  if (SECTION_LENGTH_SCALE === 1) return slots
  return slots.map(s => ({ ...s, bars: Math.max(1, Math.round(s.bars * SECTION_LENGTH_SCALE)) }))
}

let currentTemplateId: string = 'classic'
let currentSlots:      ProducerArrangementSlot[] = scaleSlots(TEMPLATE_CLASSIC)
let currentTotalBars:  number = currentSlots.reduce((sum, s) => sum + s.bars, 0)

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
  currentSlots      = scaleSlots(template.slots)
  currentTotalBars  = currentSlots.reduce((sum, s) => sum + s.bars, 0)
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
//   - texture stays present as a low pad bed. The orchestrator's
//     textureEnabled switch can still mute it, but the arrangement should not
//     silently zero out the TextureGenerator after it has built a keys/pad part.
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
    texture:       round2(0.30 + (1 - energy) * 0.20),
    energy,
    drumDropout:   false,
    bassDropout:   false,
    melodyDropout: false,
    orchestration: section.orchestration,
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

/** Get the active slots (plan slots if loaded, otherwise current template slots). */
export function getActiveProducerSlots(): ProducerArrangementSlot[] {
  return planSlots ?? currentSlots
}

// Deprecated const exports — kept for backward compat with old call sites
// that still import them. Always reflect the CLASSIC template's bar count
// (the only safe constant — actual cycle length is template-dependent).
// New code should call getProducerArrangementTotalBars() instead.
export const PRODUCER_ARRANGEMENT: ProducerArrangementSlot[] = currentSlots
export const PRODUCER_ARRANGEMENT_TOTAL_BARS: number = currentTotalBars
