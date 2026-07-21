// server/services/composer.ts
//
// The Composer slot: turns a user's free-form intent ("trap banger, dark,
// 140 BPM") into an `ArrangementPlan` — the single artifact both ACE-Step
// (audio renderer) and the live engine's Conductor consume.
//
// Brain relay (band-rack spec, Part B): the best available brain writes the
// plan, and no brain is trusted — every link's output goes through the same
// menu clamping + validateArrangementPlan, falling through on any failure.
//
//   Claude (Anthropic API, claude-opus-4-8; the COMPOSER seat)
//     → Ollama (local/Railway llama)
//       → deterministic plan builder (always succeeds)
//
// Seat assignment: CLAUDE composes (one offline plan per session, seconds of
// latency fine), OLLAMA conducts live (server/services/conductorBrain.ts).
// COMPOSER_BRAIN=claude|ollama|deterministic pins a single link so each can
// be tested in isolation; unset runs the full chain.

import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import {
  validateArrangementPlan,
  sanitizeSectionScore,
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
  // 34-bar skeleton tuned for FREESTYLING OVER, not cinematic listening.
  // The groove never goes empty — there is always a drum+bass pocket to ride.
  // The build/drop comes from ADDING layers and energy on top of that constant
  // foundation, NOT from stripping it to silence. A prior "dramatic" version
  // had intro/breakdown with density ~0.05 (drums basically off) stretched over
  // 4 bars each — which read as "slow, full of pauses, nothing filling the
  // space." Fixed: every section keeps a real density floor (≥0.45 → audible
  // groove), and the sparse moments are short.
  // Section intent (all keep the pocket alive):
  //   intro     — SHORT, drums already grooving lighter, sets up fast
  //   verse     — full band, the home pocket
  //   build     — tension rising, hats subdivide, energy climbs
  //   drop      — full force, everything pushed
  //   breakdown — pulled back but STILL grooving (not empty), sets up drop2
  //   drop2     — return harder
  { name: 'intro',     bars: 2, energy: 0.42, density: 0.45 },
  { name: 'verse',     bars: 8, energy: 0.62, density: 0.62 },
  { name: 'build',     bars: 4, energy: 0.82, density: 0.80 },
  { name: 'drop',      bars: 8, energy: 0.97, density: 0.95 },
  { name: 'breakdown', bars: 4, energy: 0.55, density: 0.50 },
  { name: 'drop2',     bars: 8, energy: 1.00, density: 0.97 },
]

// Per-section orchestration — the composer's "who plays / how forward" call,
// the categorical intent the section-intent comments above always described
// but only ever encoded as a density number. The live engine reads this so
// instruments actually sit out / lead instead of all playing full-time.
// NOTE: no section sets drums or bass to 'out'. Freestyling needs a constant
// pocket to ride — the groove must never disappear. Build/drop intensity comes
// from energy/density and from melody/chord/texture LEADING, not from cutting
// the rhythm section to silence. (intro/breakdown drums were 'out' here, which
// — on top of low density — left long empty stretches that read as "slow, full
// of pauses, nothing filling the space.")
// CHORDS ARE THE HOOK (2026-07-17 flip, per the user's reference study): most
// modern beats use keys/pads/chords AS the melody+harmony — the chord loop IS
// the hook, a separate lead melody is sparse or absent. The old map was
// inverted (melody-led). Chord 'lead' also flips the ChordImproviser into
// hook mode client-side; melody stays 'support' everywhere so it answers in
// the gaps instead of noodling over the hook.
const SECTION_ORCHESTRATION: Record<ArrangementSectionName, SectionOrchestration> = {
  intro:     { drums: 'support', bass: 'support', chord: 'lead', melody: 'support', texture: 'support' },
  verse:     { drums: 'support', bass: 'support', chord: 'lead', melody: 'support', texture: 'support' },
  build:     { drums: 'support', bass: 'support', chord: 'lead', melody: 'support', texture: 'support' },
  drop:      { drums: 'lead',    bass: 'lead',    chord: 'lead', melody: 'support', texture: 'support' },
  drop2:     { drums: 'lead',    bass: 'lead',    chord: 'lead', melody: 'support', texture: 'support' },
  breakdown: { drums: 'support', bass: 'support', chord: 'lead', melody: 'support', texture: 'support' },
  outro:     { drums: 'support', bass: 'support', chord: 'lead', melody: 'support', texture: 'support' },
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
  /** Ask the brain to WRITE THE NOTES (per-section melody + chord-hook
   *  rhythm). Claude-only — small local models produce noise here. */
  includeScores?: boolean
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

${opts.includeScores ? `
WRITE THE NOTES — for EVERY section also emit a "score": the actual performance, composed like a real musician, not a pattern generator.
- Grid: 4 bars of 16th-note slots, slot 0..63 (slot = bar*16 + sixteenth). The band loops this 4-bar score for the whole section.
- "score.melody": the HOOK phrase, 8-24 notes. midi pitch (write in the plan's key; comfortable register 65-88), durSlots 1-8, vel 0.4-1.0. Compose a SHORT MEMORABLE MOTIF (2-4 notes) stated in bar 1, repeated with development (transposition within the key, rhythmic displacement, an answering phrase in bars 3-4). Syncopate — land notes on off-beats and let some notes breathe (rests are music). NEVER continuous streams of equal 16ths. Think: a riff someone could hum after one listen.
- "score.chordHits": the keys-hook rhythm, 4-16 hits: slot, durSlots 1-32, vel 0.4-0.85. This is WHEN the chord voicing strikes — write a syncopated comping pattern with personality (pushes on the and-of-2, anticipations into bar boundaries, space in the back half). The engine supplies the voicing; you supply the rhythm.
- Match each section's energy: intro/breakdown scores sparse and airy, drops dense and insistent. Vary velocity musically — accents on motif landings, ghosted approach notes.
- Example section with score:
  { "name": "verse", "bars": 8, "progression": ["i","VI","III","VII"], "energy": 0.6, "density": 0.55, "style": "...",
    "score": { "melody": [ {"slot":0,"midi":76,"durSlots":3,"vel":0.85}, {"slot":6,"midi":79,"durSlots":2,"vel":0.7}, ... ],
               "chordHits": [ {"slot":0,"durSlots":6,"vel":0.6}, {"slot":10,"durSlots":4,"vel":0.5}, ... ] } }
` : ''}
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
 * Defensive validation shared by every brain link. Takes the raw JSON string
 * a model produced, clamps template/style picks to the allowed menus, fills
 * missing orchestration, and validates against the shared schema. Returns
 * null on ANY problem so the relay falls through to the next link — no brain
 * is trusted.
 */
function validateBrainPlan(
  raw: string,
  brainName: string,
  scaffold: ArrangementPlan,
  allowedTemplateIds: string[],
  allowedStyleIds: string[],
): ArrangementPlan | null {
  try {
    // Models occasionally wrap JSON in markdown fences despite instructions.
    const stripped = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(stripped)
    // Always assign a server-side ID even if the model emitted one — the
    // ID has to be unique across sessions, and we can't trust LLM output.
    parsed.id = scaffold.id
    // Reject any templateId or section styleId not in the allowed pool —
    // models sometimes hallucinate ids that "sound right".
    if (!parsed.templateId || !allowedTemplateIds.includes(parsed.templateId)) {
      console.warn(`[composer] ${brainName} picked unknown templateId "${parsed.templateId}"; falling back to "${scaffold.templateId}"`)
      parsed.templateId = scaffold.templateId
    }
    if (Array.isArray(parsed.sections)) {
      for (let i = 0; i < parsed.sections.length; i++) {
        const section = parsed.sections[i]
        if (section && typeof section === 'object' && (!section.style || !allowedStyleIds.includes(section.style))) {
          const fallbackStyle = scaffold.sections[i]?.style ?? allowedStyleIds[0]
          console.warn(`[composer] ${brainName} picked unknown style "${section.style}" for section "${section.name}"; falling back to "${fallbackStyle}"`)
          section.style = fallbackStyle
        }
        // A plan must never ship a section without orchestration — the live
        // engine relies on it to decide who plays. Fill from the section name.
        if (section && typeof section === 'object' && !section.orchestration) {
          section.orchestration = fillOrchestration(section.name)
        }
        // Note-level scores: sanitize (pitch-snap to key scale, clamp slots/
        // velocities, cap counts) or drop. A dropped score just means the
        // improvisers play that section — never a rejected plan.
        if (section && typeof section === 'object' && section.score !== undefined) {
          const sanitized = sanitizeSectionScore(
            section.score,
            typeof parsed.key === 'string' ? parsed.key : scaffold.key,
            Array.isArray(section.progression) ? section.progression : [],
          )
          if (sanitized) section.score = sanitized
          else delete section.score
        }
      }
    }
    const problem = validateArrangementPlan(parsed)
    if (problem) {
      console.warn(`[composer] ${brainName} plan rejected: ${problem}.`)
      return null
    }
    console.log(`[composer] Built ArrangementPlan with ${brainName}`)
    return parsed as ArrangementPlan
  } catch (err) {
    console.warn(`[composer] ${brainName} compose failed:`, (err as Error).message)
    return null
  }
}

/** Shared prompt inputs for one compose call. */
function buildPromptContext(input: ComposerInput, scaffold: ArrangementPlan) {
  // When the UI hasn't locked anything, both catalogs are fully exposed;
  // when locked, the menu shrinks so no brain can pick outside the range.
  const allowedTemplateIds = input.allowedTemplateIds && input.allowedTemplateIds.length > 0
    ? input.allowedTemplateIds
    : ARRANGEMENT_TEMPLATE_CATALOG.map(t => t.id)
  const allowedStyleIds = input.allowedStyleIds && input.allowedStyleIds.length > 0
    ? input.allowedStyleIds
    : STYLE_PRESETS.map(s => s.id)
  const systemPrompt = buildComposerSystemPrompt({ allowedTemplateIds, allowedStyleIds })
  // Claude also writes the per-section note-level scores (melody + chord hook).
  const systemPromptWithScores = buildComposerSystemPrompt({ allowedTemplateIds, allowedStyleIds, includeScores: true })
  const userMessage = [
    input.prompt ? `User intent: ${input.prompt}` : '',
    input.sectionCount ? `Target section count: ${input.sectionCount}` : '',
    `Seed plan to refine (use this key/bpm/subGenre unless the user explicitly asked for different):`,
    JSON.stringify(scaffold),
  ].filter(Boolean).join('\n')
  return { allowedTemplateIds, allowedStyleIds, systemPrompt, systemPromptWithScores, userMessage }
}

// ── Brain links ──────────────────────────────────────────────────────

// Lazy singleton — constructing the client without a key would throw at
// import time and take the whole route module down with it.
let anthropicClient: Anthropic | null = null
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!anthropicClient) {
    // The composer is an offline seat: one call per session start, seconds
    // of latency acceptable — but don't let a hung request sit for the SDK's
    // 10-minute default.
    anthropicClient = new Anthropic({ timeout: 60_000, maxRetries: 1 })
  }
  return anthropicClient
}

/** Claude link — the composer seat. Returns null when unconfigured or on any failure. */
async function composeWithClaude(
  ctx: ReturnType<typeof buildPromptContext>,
  scaffold: ArrangementPlan,
): Promise<ArrangementPlan | null> {
  const client = getAnthropic()
  if (!client) return null
  try {
    // Fast mode: the composer is latency-sensitive product-wise (the sooner
    // the plan lands, the sooner the band plays the written score instead of
    // jamming), so pay the fast-mode premium on this one small per-session
    // call. `thinking` omitted = off on Opus 4.8 — the score prompt is
    // prescriptive enough that thinking mostly added latency here.
    const response = await client.beta.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      speed: 'fast',
      betas: ['fast-mode-2026-02-01'],
      system: ctx.systemPromptWithScores,
      messages: [{ role: 'user', content: ctx.userMessage }],
    })
    if (response.stop_reason === 'refusal') {
      console.warn('[composer] Claude declined the request; falling through.')
      return null
    }
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map(b => b.text)
      .join('')
    return validateBrainPlan(text, 'Claude', scaffold, ctx.allowedTemplateIds, ctx.allowedStyleIds)
  } catch (err) {
    // Fast mode has its own rate limit / availability — never let a fast-mode
    // failure cost us the Claude link. One standard-speed retry.
    console.warn('[composer] Claude fast-mode compose failed, retrying standard:', (err as Error).message)
    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        system: ctx.systemPromptWithScores,
        messages: [{ role: 'user', content: ctx.userMessage }],
      })
      if (response.stop_reason === 'refusal') return null
      const text = response.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map(b => b.text)
        .join('')
      return validateBrainPlan(text, 'Claude', scaffold, ctx.allowedTemplateIds, ctx.allowedStyleIds)
    } catch (err2) {
      console.warn('[composer] Claude compose failed:', (err2 as Error).message)
      return null
    }
  }
}

/** Ollama link. Returns null on any failure. */
async function composeWithOllama(
  ctx: ReturnType<typeof buildPromptContext>,
  scaffold: ArrangementPlan,
): Promise<ArrangementPlan | null> {
  try {
    const raw = await localAI.chat(
      [
        { role: 'system', content: ctx.systemPrompt },
        { role: 'user',   content: ctx.userMessage },
      ],
      { format: 'json', temperature: 0.55 },
    )
    return validateBrainPlan(raw, 'Ollama', scaffold, ctx.allowedTemplateIds, ctx.allowedStyleIds)
  } catch (err) {
    console.warn('[composer] Ollama compose failed:', (err as Error).message)
    return null
  }
}

// ── Public API ───────────────────────────────────────────────────────

// ── Plan cache (serve instantly, refresh behind) ─────────────────────
// A Claude composition takes seconds-to-a-minute; a session start should not.
// Cache the last LLM-written plan per musical intent and serve it IMMEDIATELY
// while a fresh composition replaces it in the background — every start after
// the first gets a real written score with zero wait. Deterministic plans are
// never cached (they're instant anyway and would poison the cache).
const PLAN_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const planCache = new Map<string, { plan: ArrangementPlan; at: number }>()
const refreshInFlight = new Set<string>()

function cacheKey(input: ComposerInput): string {
  return [input.subGenre ?? '', input.mood ?? '', input.bpm ?? '', input.prompt ?? '',
    (input.allowedStyleIds ?? []).join(','), (input.allowedTemplateIds ?? []).join(',')].join('|')
}

/** Deep-copy a cached plan with a fresh id so sessions never share plan ids. */
function clonePlan(plan: ArrangementPlan): ArrangementPlan {
  return { ...structuredClone(plan), id: randomUUID() }
}

class RelayComposer implements Composer {
  private async composeUncached(input: ComposerInput): Promise<{ plan: ArrangementPlan; fromLLM: boolean }> {
    const scaffold = buildDeterministicPlan(input)
    const ctx = buildPromptContext(input, scaffold)
    // COMPOSER_BRAIN pins one link for isolated dev testing; unset = full chain.
    const pin = process.env.COMPOSER_BRAIN
    if (pin === 'deterministic') return { plan: scaffold, fromLLM: false }
    if (pin !== 'ollama') {
      const claudePlan = await composeWithClaude(ctx, scaffold)
      if (claudePlan) return { plan: claudePlan, fromLLM: true }
      if (pin === 'claude') return { plan: scaffold, fromLLM: false }
    }
    const ollamaPlan = await composeWithOllama(ctx, scaffold)
    return ollamaPlan ? { plan: ollamaPlan, fromLLM: true } : { plan: scaffold, fromLLM: false }
  }

  async compose(input: ComposerInput): Promise<ArrangementPlan> {
    const key = cacheKey(input)
    const cached = planCache.get(key)
    const fresh = cached && Date.now() - cached.at < PLAN_CACHE_TTL_MS

    if (cached && fresh) {
      // Serve instantly; refresh behind so the NEXT start gets a new take.
      if (!refreshInFlight.has(key)) {
        refreshInFlight.add(key)
        void this.composeUncached(input)
          .then(({ plan, fromLLM }) => { if (fromLLM) planCache.set(key, { plan, at: Date.now() }) })
          .catch(() => { /* keep serving the cached plan */ })
          .finally(() => refreshInFlight.delete(key))
      }
      console.log('[composer] served cached plan (background refresh kicked)')
      return clonePlan(cached.plan)
    }

    const { plan, fromLLM } = await this.composeUncached(input)
    if (fromLLM) planCache.set(key, { plan, at: Date.now() })
    return plan
  }
}

/** Default composer — Claude → Ollama → deterministic relay. */
export const composer: Composer = new RelayComposer()

/** Direct access to the deterministic builder, for tests and routes that
 *  want to bypass the LLM entirely (e.g. a "rebuild without LLM" button). */
export { buildDeterministicPlan as composeDeterministic }
