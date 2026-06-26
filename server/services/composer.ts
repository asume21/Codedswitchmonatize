// server/services/composer.ts
//
// The Composer slot: turns a user's free-form intent ("trap banger, dark,
// 140 BPM") into an `ArrangementPlan` — the single artifact both ACE-Step
// (audio renderer) and the live engine's Conductor consume.
//
// Today this is Ollama with a JSON-format system prompt, falling back to a
// deterministic plan when Ollama is unavailable or returns malformed JSON.
// The slot is interchangeable: a future WebLLM-in-browser composer or a
// Grok cloud composer plugs into the same Composer interface from
// shared/arrangement.ts and the readers don't need to know which produced
// the plan.
//
// Fallback chain (mirrors server/routes/aceStep.ts:buildAceStepPrompt):
//   Ollama JSON output → deterministic plan builder
// Grok fallback is intentionally NOT here yet — adding it is a one-call
// edit once the deterministic path proves reliable in prod.

import { randomUUID } from 'node:crypto'
import {
  validateArrangementPlan,
  type ArrangementPlan,
  type ArrangementSection,
  type ArrangementSectionName,
  type SectionOrchestration,
  type Composer,
  type ComposerInput,
} from '../../shared/arrangement'
import {
  STYLE_PRESETS,
  pickStylePreset,
  getStylePreset,
} from '../../shared/stylePresets'
import { ARRANGEMENT_TEMPLATE_CATALOG } from '../../shared/arrangementTemplates'
import { localAI } from './localAI'
import { getProgressionForSection } from './musicMind'

// ── Defaults / fallback library ──────────────────────────────────────

// Producer-style 32-bar arrangement skeleton. Matches the live engine's
// PRODUCER_ARRANGEMENT layout so the same plan can drive both surfaces
// without rebar-counting.
const DEFAULT_SECTION_SKELETON: Array<{
  name: ArrangementSectionName
  bars: number
  energy: number
  density: number
}> = [
  // 36-bar skeleton with explicit section intent. Sections were doubled from
  // the old 2–4 bar form: at 2 bars a section is ~3.5s at 140 BPM and flashed
  // by before the ear could register the intro→build→drop arc (it just felt
  // "fast, nothing changing"). At 4–8 bars each section lasts long enough to
  // settle in and to HEAR the build and the drop land. First drop now hits at
  // bar 16. Total 36 bars ≈ 96s at 90 BPM, ≈ 62s at 140 BPM.
  // Section intent:
  //   intro     — chords + melody set the mood, drums OUT (staggered entrance)
  //   verse     — drums drop in, full band
  //   build     — tension rising into the drop
  //   drop      — full force
  //   breakdown — drums OUT, sparse, gives the next drop weight
  //   drop2     — return to drop energy, pushed harder
  { name: 'intro',     bars: 4, energy: 0.26, density: 0.04 },  // density low → drums out
  { name: 'verse',     bars: 8, energy: 0.60, density: 0.55 },
  { name: 'build',     bars: 4, energy: 0.82, density: 0.78 },
  { name: 'drop',      bars: 8, energy: 0.97, density: 0.92 },
  { name: 'breakdown', bars: 4, energy: 0.40, density: 0.05 },  // density low → drums out
  { name: 'drop2',     bars: 8, energy: 1.00, density: 0.95 },
]

// Per-section orchestration — the composer's "who plays / how forward" call,
// the categorical intent the section-intent comments above always described
// but only ever encoded as a density number. The live engine reads this so
// instruments actually sit out / lead instead of all playing full-time.
const SECTION_ORCHESTRATION: Record<ArrangementSectionName, SectionOrchestration> = {
  intro:     { drums: 'out',     bass: 'support', chord: 'lead',    melody: 'support', texture: 'support' },
  verse:     { drums: 'support', bass: 'support', chord: 'support', melody: 'lead',    texture: 'support' },
  build:     { drums: 'support', bass: 'support', chord: 'support', melody: 'support', texture: 'support' },
  drop:      { drums: 'lead',    bass: 'lead',    chord: 'support', melody: 'support', texture: 'support' },
  drop2:     { drums: 'lead',    bass: 'lead',    chord: 'support', melody: 'support', texture: 'support' },
  breakdown: { drums: 'out',     bass: 'support', chord: 'support', melody: 'lead',    texture: 'support' },
  outro:     { drums: 'support', bass: 'support', chord: 'lead',    melody: 'support', texture: 'out'     },
}

/** Orchestration for a section name, defaulting to all-'support' for any name
 *  not in the map. A plan must NEVER ship a section without orchestration. */
function fillOrchestration(name: ArrangementSectionName): SectionOrchestration {
  return SECTION_ORCHESTRATION[name] ?? {
    drums: 'support', bass: 'support', chord: 'support', melody: 'support', texture: 'support',
  }
}

// Sensible defaults when ComposerInput leaves a field unset.
function resolveDefaults(input: ComposerInput): Required<Pick<ArrangementPlan,
  'key' | 'bpm' | 'subGenre' | 'mood'>> {
  const subGenre = input.subGenre ?? 'boom-bap'
  // BPM defaults per sub-genre — the values our drum/groove libraries assume
  // when nothing else is supplied.
  const bpmDefaults: Record<string, number> = {
    'boom-bap': 90, 'lo-fi': 75, 'trap': 140, 'drill': 144,
    'r&b': 80, 'soul': 75, 'chill': 80, 'west-coast': 92,
    'dirty-south': 75, 'phonk': 130, 'afrobeat': 105,
    'jersey-club': 130, 'bounce': 95, 'reggaeton': 95, 'hip-hop': 90,
  }
  return {
    key:      input.key      ?? 'C',
    bpm:      input.bpm      ?? bpmDefaults[subGenre] ?? 90,
    subGenre,
    mood:     input.mood     ?? 'focused',
  }
}

/**
 * Build a fully-formed plan without any LLM. Used as the cold-start
 * fallback when Ollama is unreachable or returns garbage, and as the
 * scaffold the LLM is asked to refine.
 */
export function buildDeterministicPlan(input: ComposerInput): ArrangementPlan {
  const defaults = resolveDefaults(input)

  // Filter the StylePreset bank to allowed ids if the caller supplied a
  // whitelist (UI lock). Empty allowedStyleIds = use the full bank.
  const allowedStyles = input.allowedStyleIds && input.allowedStyleIds.length > 0
    ? STYLE_PRESETS.filter(s => input.allowedStyleIds!.includes(s.id))
    : STYLE_PRESETS
  const stylePool = allowedStyles.length > 0 ? allowedStyles : STYLE_PRESETS

  const sections: ArrangementSection[] = DEFAULT_SECTION_SKELETON.map((slot) => {
    // Pick a curated style from the allowed pool. When the UI hasn't locked
    // anything, this scores all bank entries; when locked, scoring runs over
    // the filtered subset.
    const style = pickStylePreset({
      energy:   slot.energy,
      mood:     defaults.mood,
      subGenre: defaults.subGenre,
      candidates: stylePool,
    })
    return {
      name:        slot.name,
      bars:        slot.bars,
      progression: getProgressionForSection(defaults.subGenre, slot.name),
      energy:      slot.energy,
      density:     slot.density,
      style:       style?.id,
      orchestration: fillOrchestration(slot.name),
    }
  })

  // Pick the structural template. When the caller locked one (UI), use that;
  // otherwise pick a random one from the allowed range. Deterministic picker
  // — randomness within range so the same preset doesn't always produce the
  // same form.
  const allowedTemplateIds = input.allowedTemplateIds && input.allowedTemplateIds.length > 0
    ? input.allowedTemplateIds.filter(id => ARRANGEMENT_TEMPLATE_CATALOG.some(t => t.id === id))
    : ARRANGEMENT_TEMPLATE_CATALOG.map(t => t.id)
  const templateId = allowedTemplateIds.length > 0
    ? allowedTemplateIds[Math.floor(Math.random() * allowedTemplateIds.length)]
    : 'classic'

  const acePrompt = [
    defaults.subGenre,
    'hip-hop',
    defaults.mood,
    `${defaults.bpm} bpm`,
    'studio quality',
    'professional mix',
    'no vocals',
  ].join(', ')

  return {
    id: randomUUID(),
    key: defaults.key,
    bpm: defaults.bpm,
    subGenre: defaults.subGenre,
    mood: defaults.mood,
    templateId,
    sections,
    acePrompt,
  }
}

// ── Ollama-backed composer ───────────────────────────────────────────

/** Build the system prompt fresh on each call so the catalog (styles +
 *  templates) stays in sync with the source-of-truth banks. Cheaper to
 *  build than to remember to refresh a const when the banks change. */
function buildComposerSystemPrompt(opts: {
  allowedTemplateIds: string[]
  allowedStyleIds:    string[]
}): string {
  const templateMenu = ARRANGEMENT_TEMPLATE_CATALOG
    .filter(t => opts.allowedTemplateIds.includes(t.id))
    .map(t => `  - "${t.id}" — ${t.description}`)
    .join('\n')

  const styleMenu = STYLE_PRESETS
    .filter(s => opts.allowedStyleIds.includes(s.id))
    .map(s => `  - "${s.id}" — ${s.label}: drums=${s.drumPattern}, chord=${s.chordTechnique}, bass=${s.bassArticulation}, melody=${s.melodyArticulation}; suits ${s.fitsMood.join('/')} mood at energy ${s.fitsEnergy.min}-${s.fitsEnergy.max}`)
    .join('\n')

  return `You are a hip-hop arrangement composer. You output a JSON ArrangementPlan that describes a complete song's structure — key, BPM, sub-genre, mood, a STRUCTURAL TEMPLATE, and a list of sections. Each section names its STYLE (a curated combination of techniques the band plays).

Rules:
- Return ONLY a JSON object — no markdown fences, no commentary.
- Roman numerals: I/i for tonic, ii/II for supertonic, … VII/vii for leading tone. Lowercase = minor, uppercase = major. Suffixes: m7, maj7, 7, sus2, sus4, dim, dim7, 9, maj9, m9, add9, 6. Accidentals: bIII, #IV.
- Sub-genre is one of: boom-bap, lo-fi, trap, drill, r&b, soul, chill, west-coast, dirty-south, phonk, afrobeat, jersey-club, bounce, reggaeton, hip-hop.
- bars per section: 8 or 16 (use 4 only for a short intro). Favor LONGER sections — each section must last long enough for a listener to settle in and HEAR the build and the drop land. Total song should be ~32–48 bars.
- Sections must flow musically with a DRAMATIC dynamic arc — intro sparse (drums out, just chords/melody), verse full band, build rising, drop hardest/fullest, breakdown pulled way down (drums out), drop2 reprise pushed harder. The contrast between sections must be obvious.
- Include an acePrompt: 8–14 comma-separated tags for the audio renderer.

STRUCTURAL TEMPLATES — pick ONE id for plan.templateId based on the song's overall character:
${templateMenu}

STYLES — pick ONE id for each section.style based on the section's energy and the song's mood. A style is a curated combination of (drum pattern + chord technique + bass articulation + melody articulation) that musically fits together:
${styleMenu}

JSON shape:
{ "id": "string", "key": "C", "bpm": 90, "subGenre": "boom-bap", "mood": "nostalgic",
  "templateId": "classic",
  "acePrompt": "boom bap, dusty drums, jazz piano, 90 bpm, mellow, no vocals",
  "sections": [
    { "name": "intro", "bars": 4, "progression": ["i","VI","III","VII"], "energy": 0.26, "density": 0.04, "style": "lofi-warm" },
    { "name": "verse", "bars": 8, "progression": ["i","iv","VI","III"], "energy": 0.6, "density": 0.55, "style": "..." },
    ...
  ]
}`
}

/**
 * Ask Ollama for an ArrangementPlan via the JSON-format chat endpoint.
 * Validates against the shared schema and falls back to the deterministic
 * builder on any failure (network, parse, validation). Never throws — the
 * caller always gets a usable plan.
 */
async function composeWithOllama(input: ComposerInput): Promise<ArrangementPlan> {
  const scaffold = buildDeterministicPlan(input)
  // Build the system prompt with the catalog of templates + styles the
  // composer is allowed to pick from. When the UI hasn't locked anything,
  // both catalogs are fully exposed; when locked, the menu shrinks to the
  // allowed subset so Ollama can't pick outside the user's chosen range.
  const allowedTemplateIds = input.allowedTemplateIds && input.allowedTemplateIds.length > 0
    ? input.allowedTemplateIds
    : ARRANGEMENT_TEMPLATE_CATALOG.map(t => t.id)
  const allowedStyleIds = input.allowedStyleIds && input.allowedStyleIds.length > 0
    ? input.allowedStyleIds
    : STYLE_PRESETS.map(s => s.id)

  const systemPrompt = buildComposerSystemPrompt({ allowedTemplateIds, allowedStyleIds })
  const userMessage = [
    input.prompt ? `User intent: ${input.prompt}` : '',
    input.sectionCount ? `Target section count: ${input.sectionCount}` : '',
    `Seed plan to refine (use this key/bpm/subGenre unless the user explicitly asked for different):`,
    JSON.stringify(scaffold),
  ].filter(Boolean).join('\n')

  try {
    const raw = await localAI.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      { format: 'json', temperature: 0.55 },
    )
    const parsed = JSON.parse(raw)
    // Always assign a server-side ID even if the model emitted one — the
    // ID has to be unique across sessions, and we can't trust LLM output.
    parsed.id = scaffold.id
    // Defensive validation: reject any templateId or section styleId not
    // in the allowed pool. Ollama sometimes hallucinates ids that "sound
    // right" — clamp to the menu it was given.
    if (!parsed.templateId || !allowedTemplateIds.includes(parsed.templateId)) {
      console.warn(`[composer] Ollama picked unknown templateId "${parsed.templateId}"; falling back to "${scaffold.templateId}"`)
      parsed.templateId = scaffold.templateId
    }
    if (Array.isArray(parsed.sections)) {
      for (let i = 0; i < parsed.sections.length; i++) {
        const section = parsed.sections[i]
        if (section && typeof section === 'object' && (!section.style || !allowedStyleIds.includes(section.style))) {
          const fallbackStyle = scaffold.sections[i]?.style ?? allowedStyleIds[0]
          console.warn(`[composer] Ollama picked unknown style "${section.style}" for section "${section.name}"; falling back to "${fallbackStyle}"`)
          section.style = fallbackStyle
        }
        // A plan must never ship a section without orchestration — the live
        // engine relies on it to decide who plays. Fill from the section name.
        if (section && typeof section === 'object' && !section.orchestration) {
          section.orchestration = fillOrchestration(section.name)
        }
      }
    }
    const problem = validateArrangementPlan(parsed)
    if (problem) {
      console.warn(`[composer] Ollama plan rejected: ${problem}. Falling back to deterministic plan.`)
      return scaffold
    }
    console.log('[composer] Built ArrangementPlan with local Ollama')
    return parsed as ArrangementPlan
  } catch (err) {
    console.warn('[composer] Ollama compose failed; using deterministic plan:', err)
    return scaffold
  }
}

// ── Public API ───────────────────────────────────────────────────────

class OllamaComposer implements Composer {
  async compose(input: ComposerInput): Promise<ArrangementPlan> {
    return composeWithOllama(input)
  }
}

/** Default composer — Ollama with deterministic fallback. */
export const composer: Composer = new OllamaComposer()

/** Direct access to the deterministic builder, for tests and routes that
 *  want to bypass the LLM entirely (e.g. a "rebuild without LLM" button). */
export { buildDeterministicPlan as composeDeterministic }
