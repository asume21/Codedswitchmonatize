/**
 * loopMind — the real AI music mind for loops.
 *
 * This is the brain the whole loop-arranger effort is for. Given a loop pack
 * whose clips have been PROFILED (WebEar listened to each one — see
 * scripts/profile-loops.ts) and the song's section structure, it REASONS OUT a
 * fire arrangement: which loop plays in each row each section, building energy
 * from a sparse intro to a full drop — the way a producer digs a crate.
 *
 * It is NOT a lookup table (unlike the chord-progression musicMind). It calls a
 * real LLM, ONCE per beat (at load / re-roll time, never in the audio hot path),
 * so it costs ~nothing and can't lag a live performance.
 *
 * Safety net: if the AI call fails, returns malformed JSON, or names clips that
 * don't exist, we fall back to a deterministic energy-match so the beat ALWAYS
 * plays. The AI is the brain; the fallback is just a parachute.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LoopPack, LoopClip } from '../../shared/loopPack'

export type LoopRow = 'drums' | 'bass' | 'melody' | 'chords' | 'texture'
const ROWS: LoopRow[] = ['drums', 'bass', 'melody', 'chords', 'texture']

/** Map a LoopRow to its pool key on the pack (chords row → `chords` pool). */
const POOL: Record<LoopRow, keyof LoopPack['loops']> = {
  drums: 'drums', bass: 'bass', melody: 'melody', chords: 'chords', texture: 'texture',
}

export interface SectionBrief {
  name: string     // intro | verse | build | drop | breakdown | drop2 | outro
  energy: number   // 0–1 — how hard this section should hit
  density: number  // 0–1 — how busy/full it should be
}

/** A clip id per row, or null = that row sits out (silent) this section. */
export type Scene = Record<LoopRow, string | null>

export interface LoopArrangement {
  sections: Array<{ name: string; scene: Scene }>
  source: 'ai' | 'fallback'
  rationale?: string
}

// Google rotates model names fast — try newest→older, first that answers wins.
const MODEL_CANDIDATES = [
  process.env.GEMINI_TEXT_MODEL?.trim(),
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-001',
].filter((m): m is string => Boolean(m))

/** Compact one-line profile of a clip for the prompt (skips unprofiled detail). */
function clipLine(c: LoopClip): string {
  const p = c.profile
  if (!p) return `    - ${c.id} (${c.label ?? 'loop'}) — no profile`
  return `    - ${c.id} (${c.label ?? 'loop'}) — energy ${p.energy}, bright ${p.brightness}, busy ${p.busyness} — "${p.description.slice(0, 90).replace(/\s+/g, ' ')}"`
}

function buildCatalog(pack: LoopPack): string {
  return ROWS.map((row) => {
    const pool = pack.loops[POOL[row]] ?? []
    if (!pool.length) return `  ${row}: (none)`
    return `  ${row}:\n${pool.map(clipLine).join('\n')}`
  }).join('\n')
}

function buildPrompt(pack: LoopPack, sections: SectionBrief[]): string {
  return `You are a professional hip-hop producer arranging pre-made loops into a FIRE beat that BUILDS over its sections — sparse, inviting intro; full, hard-hitting drop; dynamics in between. You are arranging the "${pack.label}" pack (${pack.bpm} BPM, key ${pack.key}).

Available loops, by instrument row (each with how it sounds — energy/brightness/busyness 0–1):
${buildCatalog(pack)}

Song sections (in order), each with a target energy and density (0–1):
${sections.map((s, i) => `  ${i + 1}. ${s.name} — energy ${s.energy}, density ${s.density}`).join('\n')}

For EACH section, choose exactly ONE loop id per row (drums, bass, melody, chords, texture), or null to leave that row SILENT this section (use silence to make builds and drops land — e.g. pull melody/texture in the intro, drop them out before the drop, slam everything in on the drop). Pick loops whose energy/brightness/busyness fit the section's target. Match the harder/busier loops to high-energy sections and the sparser ones to low-energy sections. Keep it musical and cohesive — it should sound like ONE evolving beat, not random swaps.

Return ONLY valid JSON, no prose, in exactly this shape:
{"sections":[{"name":"<section name>","scene":{"drums":"<id or null>","bass":"<id or null>","melody":"<id or null>","chords":"<id or null>","texture":"<id or null>"}}],"rationale":"<one sentence>"}
Use only loop ids that appear in the lists above, or null.`
}

/** Pull the first JSON object out of a model response (handles ```json fences). */
function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('no JSON object in response')
  return JSON.parse(raw.slice(start, end + 1))
}

/** Deterministic energy-match arrangement — the parachute. Picks, per row per
 *  section, the clip whose energy is closest to the section's target, and mutes
 *  melody/texture in the lowest-energy sections so intros breathe. */
function fallbackArrange(pack: LoopPack, sections: SectionBrief[]): LoopArrangement {
  const pickClosest = (pool: LoopClip[], target: number): string | null => {
    if (!pool.length) return null
    let best = pool[0], bestD = Infinity
    for (const c of pool) {
      const e = c.profile?.energy ?? 0.5
      const d = Math.abs(e - target)
      if (d < bestD) { bestD = d; best = c }
    }
    return best.id
  }
  return {
    source: 'fallback',
    sections: sections.map((s) => ({
      name: s.name,
      scene: {
        drums:   pickClosest(pack.loops.drums, s.energy),
        bass:    pickClosest(pack.loops.bass, s.energy),
        // melody/texture sit out the quietest sections so builds/drops land.
        melody:  s.energy < 0.25 ? null : pickClosest(pack.loops.melody, s.energy),
        chords:  pickClosest(pack.loops.chords, s.energy),
        texture: s.energy < 0.2 ? null : pickClosest(pack.loops.texture, s.energy),
      },
    })),
  }
}

/** Validate + repair an AI scene: every non-null id must exist in its pool;
 *  unknown ids get coerced to null rather than crashing playback. */
function sanitizeScene(pack: LoopPack, scene: any): Scene {
  const out = {} as Scene
  for (const row of ROWS) {
    const id = scene?.[row]
    const exists = id != null && (pack.loops[POOL[row]] ?? []).some((c) => c.id === id)
    out[row] = exists ? id : null
  }
  return out
}

/**
 * The real AI music mind: reason out a per-section loop arrangement for a pack.
 * Always resolves — falls back to a deterministic energy-match on any failure.
 */
export async function arrangeLoops(
  pack: LoopPack,
  sections: SectionBrief[],
): Promise<LoopArrangement> {
  if (!sections.length) return { source: 'fallback', sections: [] }
  if (!process.env.GEMINI_API_KEY) return fallbackArrange(pack, sections)

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const prompt = buildPrompt(pack, sections)
    let text = ''
    let lastErr: unknown
    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        text = result.response.text()
        break
      } catch (err: any) {
        lastErr = err
        const msg = String(err?.message ?? err)
        // 404 = retired model name → try next; anything else won't be fixed by it.
        if (!/404|not found|no longer available|not supported/i.test(msg)) throw err
      }
    }
    if (!text) throw lastErr ?? new Error('no model produced output')

    const parsed = extractJson(text)
    const aiSections: any[] = Array.isArray(parsed?.sections) ? parsed.sections : []
    // Align AI output to the requested section order; if the AI dropped/renamed
    // a section, match by index so we always return one scene per section.
    const result: LoopArrangement = {
      source: 'ai',
      rationale: typeof parsed?.rationale === 'string' ? parsed.rationale : undefined,
      sections: sections.map((s, i) => {
        const match = aiSections.find((a) => a?.name === s.name) ?? aiSections[i]
        return { name: s.name, scene: sanitizeScene(pack, match?.scene) }
      }),
    }
    return result
  } catch {
    return fallbackArrange(pack, sections)
  }
}
