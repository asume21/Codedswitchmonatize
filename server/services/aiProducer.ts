import { makeAICall } from './grok'

export interface BeatSectionDirective {
  section: string
  energy: number
  subGenre: 'trap' | 'boom-bap' | 'drill' | 'r&b-soul' | 'afrobeats'
  groove: 'straight' | 'swing' | 'triplet'
  drums: { kick: number; hat: number; arrangement: number }
  bass: { volume: number }
  melody: {
    volume: number
    behavior: 'lead' | 'hint' | 'rest'
    chordTechnique: 'pad' | 'rolled' | 'stab'
  }
  reasoning: string
}

const PRODUCER_SYSTEM_PROMPT = `You are a world-class hip-hop producer AI. Your job is to direct beat arrangement in real time.

ARRANGEMENT PRINCIPLES:
- intro: sparse, builds anticipation. Kick at 50-60%, no snare yet, melody hint only.
- verse: drums lock in (70-80%), bass full, melody sparse — leave space for the rapper.
- build: everything rises 10-15%, hi-hats get denser, melody gets busier. Tension without release.
- drop: maximum energy. Full arrangement at 100%. This is the payoff — don't hold back.
- breakdown: strip to 30-40%. Sometimes just kick and hi-hat. Let the listener breathe before the return.
- drop2: return full energy, hit harder than drop1. Add density or raise hat velocity 5-10%.
- hook: same as drop but with more melodic emphasis.

GENRE CONVENTIONS:
- trap: heavy 808 kick (kick=1.0), triplet hi-hats (hat=0.85+), sliding 808 bass, minor chords, 130-150 BPM.
- boom-bap: punchy kick on 1/3, snare on 2/4, straight hats (hat=0.6-0.7), melodic bass walks, 85-100 BPM.
- drill: very sparse kick, hard snare, fast 32nd hat rolls (hat=0.9), sliding bass, extremely dark energy.
- r&b-soul: smooth groove, sub bass prominent, lush chord pads, melody forward, 70-100 BPM.
- afrobeats: syncopated kick, open hats prominent, percussive bass pattern, bright chord stabs, 100-115 BPM.

MIX BALANCE RULES:
- Kick and 808 bass share the same low-end pocket — never both at 1.0 simultaneously or it gets muddy.
- Hi-hat density is your main tension tool. Build it slowly — don't jump from 0.3 to 1.0 instantly.
- Melody should be quieter in sections where the rapper performs (verse) — typically 0.4-0.55.
- Chords carry the harmony: pad in slow sections, rolled in verse, stab (punchy) in drops.
- The breakdown should feel like taking a breath, not stopping the party.

CONTRAST RULES:
- Never go max → max → max. Always: build → peak → breathe → peak again.
- Second drop always hits harder than first (add 0.05-0.1 to energy).
- Groove consistency: once you establish triplet feel, don't switch to straight mid-song without a breakdown reset.

Think like J Dilla arranging, Metro Boomin engineering, and Pharrell producing. Be decisive. Output only valid JSON.`

export async function generateNextSectionDirective(
  currentSection: string,
  nextSection: string,
  context: {
    subGenre: string
    bpm: number
    energy: number
    barInCycle: number
    totalBars: number
    cycleCount: number
  }
): Promise<BeatSectionDirective> {
  try {
    const response = await makeAICall(
      [
        { role: 'system', content: PRODUCER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Current section: "${currentSection}" → Next section: "${nextSection}"
Sub-genre: ${context.subGenre} | BPM: ${context.bpm} | Energy: ${Math.round(context.energy * 100)}%
Position: bar ${context.barInCycle}/${context.totalBars} | Cycle: ${context.cycleCount + 1}

Decide exactly how the "${nextSection}" section should hit. Return this JSON and nothing else:
{
  "section": "${nextSection}",
  "energy": <0.0-1.0>,
  "subGenre": "<trap|boom-bap|drill|r&b-soul|afrobeats>",
  "groove": "<straight|swing|triplet>",
  "drums": { "kick": <0.0-1.0>, "hat": <0.0-1.0>, "arrangement": <0.0-1.0> },
  "bass": { "volume": <0.0-1.0> },
  "melody": { "volume": <0.0-1.0>, "behavior": "<lead|hint|rest>", "chordTechnique": "<pad|rolled|stab>" },
  "reasoning": "<one sentence why>"
}`,
        },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.72,
        max_tokens: 300,
      }
    )

    const raw = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw) as Partial<BeatSectionDirective>
    return validated(parsed, nextSection)
  } catch (err) {
    console.warn('[aiProducer] generation failed, using fallback:', err)
    return fallbackDirective(nextSection)
  }
}

function clamp(v: unknown, def: number): number {
  return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : def
}

function validated(d: Partial<BeatSectionDirective>, section: string): BeatSectionDirective {
  const validSubGenres = ['trap', 'boom-bap', 'drill', 'r&b-soul', 'afrobeats'] as const
  const validGrooves = ['straight', 'swing', 'triplet'] as const
  const validBehaviors = ['lead', 'hint', 'rest'] as const
  const validTechniques = ['pad', 'rolled', 'stab'] as const

  return {
    section,
    energy: clamp(d.energy, 0.7),
    subGenre: validSubGenres.includes(d.subGenre as any) ? (d.subGenre as BeatSectionDirective['subGenre']) : 'trap',
    groove: validGrooves.includes(d.groove as any) ? (d.groove as BeatSectionDirective['groove']) : 'straight',
    drums: {
      kick: clamp(d.drums?.kick, 0.8),
      hat: clamp(d.drums?.hat, 0.7),
      arrangement: clamp(d.drums?.arrangement, 0.8),
    },
    bass: { volume: clamp(d.bass?.volume, 0.8) },
    melody: {
      volume: clamp(d.melody?.volume, 0.6),
      behavior: validBehaviors.includes(d.melody?.behavior as any) ? (d.melody!.behavior as BeatSectionDirective['melody']['behavior']) : 'hint',
      chordTechnique: validTechniques.includes(d.melody?.chordTechnique as any) ? (d.melody!.chordTechnique as BeatSectionDirective['melody']['chordTechnique']) : 'rolled',
    },
    reasoning: typeof d.reasoning === 'string' ? d.reasoning : '',
  }
}

const FALLBACK_DIRECTIVES: Record<string, Partial<BeatSectionDirective>> = {
  intro:     { energy: 0.30, drums: { kick: 0.55, hat: 0.32, arrangement: 0.55 }, bass: { volume: 0.65 }, melody: { volume: 0.45, behavior: 'hint',  chordTechnique: 'pad'    } },
  verse:     { energy: 0.50, drums: { kick: 0.75, hat: 0.60, arrangement: 0.75 }, bass: { volume: 0.92 }, melody: { volume: 0.50, behavior: 'hint',  chordTechnique: 'rolled' } },
  build:     { energy: 0.75, drums: { kick: 0.88, hat: 0.80, arrangement: 0.88 }, bass: { volume: 0.95 }, melody: { volume: 0.82, behavior: 'hint',  chordTechnique: 'rolled' } },
  drop:      { energy: 1.00, drums: { kick: 1.00, hat: 1.00, arrangement: 1.00 }, bass: { volume: 1.00 }, melody: { volume: 1.00, behavior: 'lead',  chordTechnique: 'stab'   } },
  drop2:     { energy: 1.00, drums: { kick: 1.00, hat: 1.00, arrangement: 1.00 }, bass: { volume: 1.00 }, melody: { volume: 1.00, behavior: 'lead',  chordTechnique: 'stab'   } },
  hook:      { energy: 1.00, drums: { kick: 1.00, hat: 1.00, arrangement: 1.00 }, bass: { volume: 1.00 }, melody: { volume: 1.00, behavior: 'lead',  chordTechnique: 'stab'   } },
  breakdown: { energy: 0.35, drums: { kick: 0.42, hat: 0.28, arrangement: 0.42 }, bass: { volume: 0.68 }, melody: { volume: 0.42, behavior: 'hint',  chordTechnique: 'pad'    } },
}

function fallbackDirective(section: string): BeatSectionDirective {
  const base = FALLBACK_DIRECTIVES[section] || FALLBACK_DIRECTIVES.verse
  return validated(
    { ...base, section, subGenre: 'trap', groove: 'straight', reasoning: 'fallback' },
    section
  )
}
