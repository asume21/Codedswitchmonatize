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
  type Composer,
  type ComposerInput,
} from '../../shared/arrangement'
import { localAI } from './localAI'

// ── Defaults / fallback library ──────────────────────────────────────

// Per-sub-genre default progression — Roman numerals against the plan's
// `key`. These are the same progressions the live Conductor uses today via
// its DEFAULT_PROGRESSIONS table, just expressed in numeral form so they
// transpose for free when the composer picks a non-C key.
const DEFAULT_PROGRESSIONS: Record<string, string[]> = {
  'boom-bap':    ['i',     'iv',    'V',     'i'],
  'lo-fi':       ['Imaj7', 'iii7',  'IVmaj7','V7'],
  'trap':        ['i',     'VI',    'VII',   'i'],
  'drill':       ['i',     'v',     'VII',   'VI'],
  'r&b':         ['Imaj7', 'vi7',   'ii7',   'V7'],
  'soul':        ['vi7',   'ii7',   'V7',    'Imaj7'],
  'chill':       ['Imaj7', 'iii7',  'vi7',   'IVmaj7'],
  'west-coast':  ['i7',    'bVIImaj7', 'bVImaj7', 'V7'],
  'dirty-south': ['i',     'iv',    'V',     'i'],
  'phonk':       ['i',     'bVII',  'bVI',   'V7'],
  'afrobeat':    ['i',     'bVII',  'bVI',   'bVII'],
  'jersey-club': ['i',     'iv',    'i',     'V'],
  'bounce':      ['i',     'bIII',  'bVII',  'i'],
  'reggaeton':   ['i',     'V',     'bVI',   'V'],
  'hip-hop':     ['i',     'iv',    'V',     'i'],
}

// Producer-style 32-bar arrangement skeleton. Matches the live engine's
// PRODUCER_ARRANGEMENT layout so the same plan can drive both surfaces
// without rebar-counting.
const DEFAULT_SECTION_SKELETON: Array<{
  name: ArrangementSectionName
  bars: number
  energy: number
  density: number
}> = [
  { name: 'intro',     bars: 4, energy: 0.30, density: 0.20 },
  { name: 'verse',     bars: 8, energy: 0.55, density: 0.50 },
  { name: 'build',     bars: 4, energy: 0.75, density: 0.70 },
  { name: 'drop',      bars: 8, energy: 0.90, density: 0.85 },
  { name: 'breakdown', bars: 4, energy: 0.45, density: 0.35 },
  { name: 'drop2',     bars: 4, energy: 0.92, density: 0.88 },
]

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
  const progression = DEFAULT_PROGRESSIONS[defaults.subGenre]
                    ?? DEFAULT_PROGRESSIONS['hip-hop']

  const sections: ArrangementSection[] = DEFAULT_SECTION_SKELETON.map((slot) => ({
    name:        slot.name,
    bars:        slot.bars,
    progression: [...progression],
    energy:      slot.energy,
    density:     slot.density,
  }))

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
    sections,
    acePrompt,
  }
}

// ── Ollama-backed composer ───────────────────────────────────────────

const COMPOSER_SYSTEM_PROMPT = `You are a hip-hop arrangement composer. You output a JSON ArrangementPlan that describes a complete song's structure — key, BPM, sub-genre, mood, and a list of sections (intro/verse/build/drop/breakdown/drop2/outro). Each section has bars, a Roman-numeral chord progression against the plan's key, energy 0..1, and density 0..1.

Rules:
- Return ONLY a JSON object — no markdown fences, no commentary.
- Roman numerals: I/i for tonic, ii/II for supertonic, … VII/vii for leading tone. Lowercase = minor quality, uppercase = major. Suffixes allowed: m7, maj7, 7, sus2, sus4, dim, dim7, 9, maj9, m9, add9, 6. Accidentals: bIII, #IV.
- Sub-genre is one of: boom-bap, lo-fi, trap, drill, r&b, soul, chill, west-coast, dirty-south, phonk, afrobeat, jersey-club, bounce, reggaeton, hip-hop.
- bars per section: 4, 8, or 16.
- Sections must flow musically — intro/verse light, build rising, drop hardest, breakdown low, drop2 reprise.
- Include an acePrompt: 8–14 comma-separated tags describing instruments, drums, bass, mix vibe, mood, and BPM. Used by the audio renderer.

JSON shape:
{ "id": "string", "key": "C", "bpm": 90, "subGenre": "boom-bap", "mood": "nostalgic",
  "acePrompt": "boom bap, dusty drums, jazz piano, 90 bpm, mellow, no vocals",
  "sections": [
    { "name": "intro", "bars": 4, "progression": ["i","VI","III","VII"], "energy": 0.3, "density": 0.2 },
    ...
  ]
}`

/**
 * Ask Ollama for an ArrangementPlan via the JSON-format chat endpoint.
 * Validates against the shared schema and falls back to the deterministic
 * builder on any failure (network, parse, validation). Never throws — the
 * caller always gets a usable plan.
 */
async function composeWithOllama(input: ComposerInput): Promise<ArrangementPlan> {
  const scaffold = buildDeterministicPlan(input)
  // Pass the scaffold to the LLM as a "improve on this" seed — keeps the
  // model on-rails when the user prompt is sparse and gives it a concrete
  // target to refine when the prompt is detailed.
  const userMessage = [
    input.prompt ? `User intent: ${input.prompt}` : '',
    input.sectionCount ? `Target section count: ${input.sectionCount}` : '',
    `Seed plan to refine (use this key/bpm/subGenre unless the user explicitly asked for different):`,
    JSON.stringify(scaffold),
  ].filter(Boolean).join('\n')

  try {
    const raw = await localAI.chat(
      [
        { role: 'system', content: COMPOSER_SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      { format: 'json', temperature: 0.55 },
    )
    const parsed = JSON.parse(raw)
    // Always assign a server-side ID even if the model emitted one — the
    // ID has to be unique across sessions, and we can't trust LLM output.
    parsed.id = scaffold.id
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
