// server/services/conductorBrain.ts
//
// The Conductor's brain consult (band-rack spec, Part C — live seat).
//
// Seat assignment: OLLAMA conducts when it is installed — one small JSON decision
// per section boundary. Claude sits in the COMPOSER seat (composer.ts), which
// writes the one-shot ArrangementPlan.
//
// This file USED to say "never calls a cloud model", local-only for latency. That
// assumed Ollama exists. In production it does not, so the conductor had no brain
// at all and threw on every section boundary. Gemini Flash answers in ~1s, well
// inside the 6s budget below, so the latency reason for local-only no longer holds.
// Ollama still goes first when present (local, no quota, no network).
//
// Relay shape mirrors composer.ts: the deterministic aceEngine directive is
// built FIRST as the scaffold, Ollama is asked to refine it, and every field
// of the answer is clamped/validated against the scaffold. Late, malformed,
// or unreachable Ollama → the scaffold ships unchanged. "Never worse than
// today" is the floor: with Ollama down this endpoint behaves byte-for-byte
// like the old aceEngine-only route.
//
// Timing: the client AIDirector prefetches this one full section ahead and
// aborts at 8s. The Ollama budget here is 6s so a slow model loses the race
// server-side and the deterministic directive still answers in time.

import { aceEngine, type AceSectionDirective } from './aceEngine'

// One consult, whichever brain can answer. Ollama first (local, free, no network),
// Gemini as the cloud fallback. A brain that fails goes cold for 10min instead of
// being re-dialled every section — an absent Ollama in production was throwing an
// ERROR-level stack trace at every section boundary.
const CONDUCTOR_COOLDOWN_MS = 10 * 60 * 1000
const conductorColdUntil = new Map<string, number>()
const conductorIsCold = (name: string): boolean => {
  const until = conductorColdUntil.get(name)
  if (until == null) return false
  if (Date.now() >= until) { conductorColdUntil.delete(name); return false }
  return true
}

async function geminiConsult(system: string, user: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  // Key in a HEADER, never the query string — a fetch error carries the URL into
  // the log, and a `?key=` URL would write the API key there.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('')
  return text || null
}
import { localAI } from './localAI'

const OLLAMA_CONSULT_TIMEOUT_MS = 6000

const SUB_GENRES = ['trap', 'boom-bap', 'drill', 'r&b-soul', 'afrobeats'] as const
const GROOVES = ['straight', 'swing', 'triplet'] as const
const BEHAVIORS = ['lead', 'hint', 'rest'] as const
const TECHNIQUES = ['pad', 'rolled', 'stab'] as const

interface ConsultInput {
  currentSection: string
  energy?: number
  subGenre?: string
  bpm?: number
  barInCycle?: number
  totalBars?: number
  cycleCount?: number
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(1, v))
    : fallback
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback
}

function buildConsultPrompt(scaffold: AceSectionDirective, input: ConsultInput): string {
  return `You are the live CONDUCTOR of a five-player hip-hop band (drums, bass, chords, melody, texture). At each section boundary you make ONE small mix/feel decision for the NEXT section. You are refining a rules-based directive, not inventing a new format.

Rules:
- Return ONLY a JSON object with EXACTLY the same shape as the seed directive.
- All numeric values are 0..1. Move numbers only when the musical moment calls for it; small moves (±0.05..0.2) beat big ones.
- subGenre must be one of: ${SUB_GENRES.join(', ')}. groove: ${GROOVES.join(', ')}. melody.behavior: ${BEHAVIORS.join(', ')}. melody.chordTechnique: ${TECHNIQUES.join(', ')}.
- Think like a producer keeping a freestyler in the pocket: the groove never goes empty; contrast comes from ADDING/leading, not muting the rhythm section.
- "reasoning": one short sentence naming the move you made (e.g. "thin the hats so the drop lands harder").

Live state:
- next section: ${scaffold.section}
- bpm: ${input.bpm ?? 'unknown'}
- bar ${input.barInCycle ?? 0} of ${input.totalBars ?? 32}, cycle ${input.cycleCount ?? 0}
- current energy: ${input.energy ?? 'unknown'}

Seed directive to refine:
${JSON.stringify(scaffold)}`
}

export const conductorBrain = {
  /**
   * Directive for the next section: Ollama-refined when the local model
   * answers in time, deterministic aceEngine directive otherwise.
   * Never throws — the caller always gets a playable directive.
   */
  async nextSectionDirective(input: ConsultInput): Promise<AceSectionDirective> {
    const scaffold = await aceEngine.generateNextSection(input)

    if (process.env.CONDUCTOR_BRAIN === 'deterministic') return scaffold

    const system = buildConsultPrompt(scaffold, input)
    const user = 'Refine the seed directive for this moment. JSON only.'
    let raw: string | null = null
    let brainName = ''
    try {
      if (!conductorIsCold('ollama')) {
        try {
          raw = await localAI.chat(
            [{ role: 'system', content: system }, { role: 'user', content: user }],
            { format: 'json', temperature: 0.5, timeoutMs: OLLAMA_CONSULT_TIMEOUT_MS },
          )
          brainName = 'Ollama'
        } catch (e) {
          conductorColdUntil.set('ollama', Date.now() + CONDUCTOR_COOLDOWN_MS)
          console.warn('[conductorBrain] Ollama unavailable — cooling 10min:', (e as Error).message)
        }
      }
      if (!raw && !conductorIsCold('gemini')) {
        try {
          raw = await geminiConsult(system, user, OLLAMA_CONSULT_TIMEOUT_MS)
          brainName = 'Gemini'
        } catch (e) {
          conductorColdUntil.set('gemini', Date.now() + CONDUCTOR_COOLDOWN_MS)
          console.warn('[conductorBrain] Gemini unavailable — cooling 10min:', (e as Error).message)
        }
      }
      // No brain answered: the deterministic scaffold IS the floor, by design.
      if (!raw) return scaffold
      const parsed = JSON.parse(raw) as Partial<AceSectionDirective> & {
        drums?: Partial<AceSectionDirective['drums']>
        bass?: Partial<AceSectionDirective['bass']>
        melody?: Partial<AceSectionDirective['melody']>
      }

      // No brain is trusted: every field is clamped to range / menu, falling
      // back per-field to the deterministic scaffold.
      const directive: AceSectionDirective = {
        section: scaffold.section, // the section is the caller's, never the model's
        energy: clamp01(parsed.energy, scaffold.energy),
        subGenre: pickEnum(parsed.subGenre, SUB_GENRES, scaffold.subGenre),
        groove: pickEnum(parsed.groove, GROOVES, scaffold.groove),
        drums: {
          kick: clamp01(parsed.drums?.kick, scaffold.drums.kick),
          hat: clamp01(parsed.drums?.hat, scaffold.drums.hat),
          arrangement: clamp01(parsed.drums?.arrangement, scaffold.drums.arrangement),
        },
        bass: { volume: clamp01(parsed.bass?.volume, scaffold.bass.volume) },
        melody: {
          volume: clamp01(parsed.melody?.volume, scaffold.melody.volume),
          behavior: pickEnum(parsed.melody?.behavior, BEHAVIORS, scaffold.melody.behavior),
          chordTechnique: pickEnum(parsed.melody?.chordTechnique, TECHNIQUES, scaffold.melody.chordTechnique),
        },
        reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0
          ? `🧠 ${parsed.reasoning.trim().slice(0, 200)}`
          : scaffold.reasoning,
      }
      console.log(`[conductorBrain] ${brainName} conducted "${directive.section}": ${directive.reasoning}`)
      return directive
    } catch (err) {
      console.warn('[conductorBrain] consult failed; rules proceed unchanged:', (err as Error).message)
      return scaffold
    }
  },
}
