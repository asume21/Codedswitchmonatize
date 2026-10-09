/**
 * What the Render button asks ACE-Step for — built from what the band is
 * ACTUALLY playing.
 *
 * Design rule (ace-everywhere spec, Step 3 items 2+4; "one artifact, two
 * readers"): Render is a READER of the live score, not a second composer. It
 * used to send `currentVibe.genre ?? 'trap'`, the MIX studio's stale tempo
 * (default 120) and a paragraph of meter readings, then let the server's genre
 * presets add "jazz samples" — so the render never matched the band.
 *
 * The public ACE model is text2music with tags only (replicateService), so the
 * tags are the whole message: subGenre, real bpm, key + scale, the players on
 * stage, and the composer's own plan tags when Song Mode loaded a plan.
 * Chords/progression can't be enforced through tags — see product-review
 * Target vs. Shipped.
 */
import type { ArrangementPlan } from '@shared/arrangement'
import type { InstrumentPerformerId } from '@/organism/performers/types'

export interface LiveScore {
  /** The plan the Conductor is performing (Song Mode), or null in jam mode. */
  plan: ArrangementPlan | null
  subGenre: string
  bpm: number
  key: string
  scale: string
  /** Plan mood first; otherwise the interpreted vibe; null = don't guess. */
  mood: string | null
  performers: Partial<Record<'lead' | 'chord' | 'bass' | 'texture', InstrumentPerformerId | null>>
}

export interface RenderRequest {
  prompt: string
  bpm: number
  durationSec: number
}

export const DEFAULT_RENDER_SECONDS = 120
/** lucataco/ace-step accepts 1..240 s. */
const MAX_RENDER_SECONDS = 240
const MIN_RENDER_SECONDS = 30
/** Plan tags come from an LLM — bound them like any other outside text. */
const MAX_PLAN_TAGS = 14
const MAX_TAG_CHARS = 40

/** ACE-Step's vocabulary for our performer ids. */
const PERFORMER_TAGS: Partial<Record<InstrumentPerformerId, string>> = {
  'guitar-nylon':     'nylon guitar',
  'guitar-clean':     'clean electric guitar',
  'guitar-distorted': 'distorted guitar',
  'bass-electric':    'electric bass',
  'bass-upright':     'upright bass',
  'bass-synth':       'synth bass',
  'french-horn':      'french horn',
}

function performerTag(id: InstrumentPerformerId): string {
  return PERFORMER_TAGS[id] ?? id.replace(/-/g, ' ')
}

function cleanTag(tag: string): string {
  return tag.replace(/[^\p{L}\p{N}#&' +-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_CHARS)
}

function planTags(plan: ArrangementPlan): string[] {
  return plan.acePrompt
    .split(',')
    .map(cleanTag)
    // The live tempo wins — a plan's "90 bpm" is stale once the user retimes.
    .filter((t) => t && !/\bbpm\b/i.test(t))
    .slice(0, MAX_PLAN_TAGS)
}

function planSeconds(plan: ArrangementPlan, bpm: number): number | null {
  const bars = plan.sections.reduce((n, s) => n + (Number.isFinite(s.bars) ? s.bars : 0), 0)
  if (bars <= 0 || bpm <= 0) return null
  const secs = Math.round((bars * 4 * 60) / bpm)
  return Math.max(MIN_RENDER_SECONDS, Math.min(MAX_RENDER_SECONDS, secs))
}

export function buildRenderRequest(score: LiveScore): RenderRequest {
  const bpm = Math.round(score.bpm)
  const players = (['lead', 'chord', 'bass', 'texture'] as const)
    .map((role) => score.performers[role])
    .filter((id): id is InstrumentPerformerId => !!id)
    .map(performerTag)

  const tags = [
    cleanTag(score.subGenre),
    'hip-hop',
    ...(score.plan ? planTags(score.plan) : []),
    `${bpm} bpm`,
    cleanTag(`${score.key} ${score.scale}`),
    score.mood ? cleanTag(score.mood) : '',
    ...players,
    'instrumental',
    'no vocals',
  ].filter(Boolean)

  return {
    prompt: Array.from(new Set(tags.map((t) => t.toLowerCase()))).join(', '),
    bpm,
    durationSec: (score.plan && planSeconds(score.plan, bpm)) ?? DEFAULT_RENDER_SECONDS,
  }
}
