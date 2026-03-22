import { getGenreSpec } from "../knowledge/genreDatabase";
import { getGenreInsights } from "../knowledge/genreInsights";
import { getProgressionsForGenre } from "../knowledge/musicTheory";

export interface AstutelyPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    style: string;
    genreName?: string;
    hasInsights: boolean;
    progressionCount: number;
    tempo?: number;
    timeSignature?: { numerator: number; denominator: number };
    key?: string;
    trackSummaryCount?: number;
  };
}

interface BuildPromptOptions {
  tempo?: number;
  timeSignature?: { numerator: number; denominator: number };
  key?: string;
  tracks?: Array<{
    id?: string;
    name?: string;
    instrument?: string;
    type?: string;
    notes?: number;
    muted?: boolean;
    volume?: number;
  }>;
}

export function buildAstutelyPrompt(style: string, safePrompt: string, options: BuildPromptOptions = {}): AstutelyPrompt {
  const genreSpec = getGenreSpec(style);
  const insights = getGenreInsights(style);
  const progressions = getProgressionsForGenre(style).slice(0, 3);

  let systemPrompt = "You are Astutely, an elite AI music producer. Create a 4-bar loop (64 steps) with drums, bass, chords, melody.";

  if (genreSpec) {
    systemPrompt += `\n🎯 GENRE DNA — ${genreSpec.name}
BPM Range: ${genreSpec.bpmRange[0]}-${genreSpec.bpmRange[1]}
Preferred Keys: ${genreSpec.preferredKeys.join(', ')}
Bass: ${genreSpec.bassStyle}
Drums: ${genreSpec.drumPattern}
Chords: ${genreSpec.chordStyle}
Mood: ${genreSpec.mood}
Essentials: ${genreSpec.instruments.join(', ')}
Avoid: ${genreSpec.avoidInstruments.join(', ')}
Tips: ${genreSpec.productionTips.join('. ')}
Refs: ${genreSpec.referenceArtists.join(', ')}`;
  }

  if (insights) {
    systemPrompt += `\n🧠 GENRE INSIGHTS
Energy Curve: ${insights.energyCurve}
Signature Elements: ${insights.signatureElements.join('; ')}
Sections: ${insights.sectionBlueprint.map(s => `${s.section} ${s.bars}b`).join(' | ')}
Loop Tips: ${insights.loopTips.join('; ')}${insights.vocalProfile ? `
Vocal Profile: ${insights.vocalProfile}` : ''}`;
  }

  if (progressions.length) {
    systemPrompt += `\n🎼 THEORY TOOLKIT
${progressions.map(p => `${p.name}: ${p.pattern.join(' → ')} (Mood: ${p.mood})`).join('\n')}
Use tight voice leading.`;
  }

  if (options.tempo) {
    systemPrompt += `\n⏱️ TEMPO: Lock the groove at exactly ${options.tempo} BPM.`;
  }

  if (options.timeSignature) {
    systemPrompt += `\n📐 TIME SIGNATURE: Compose strictly in ${options.timeSignature.numerator}/${options.timeSignature.denominator}.`;
  }

  if (options.key) {
    systemPrompt += `\n🔑 KEY CONTEXT: Stay locked to the key of ${options.key}.`;
  }

  if (options.tracks && options.tracks.length) {
    const summarizedTracks = options.tracks
      .slice(0, 12)
      .map((track, idx) => {
        const parts: string[] = [];
        parts.push(`${idx + 1}. ${track.name ?? track.type ?? 'Track'}`);
        if (track.instrument) {
          parts.push(`Instrument: ${track.instrument}`);
        }
        if (typeof track.notes === 'number') {
          parts.push(`Notes: ${track.notes}`);
        }
        if (typeof track.volume === 'number') {
          parts.push(`Vol: ${track.volume}`);
        }
        if (typeof track.muted === 'boolean' && track.muted) {
          parts.push('Muted');
        }
        return parts.join(' | ');
      })
      .join('\n');

    systemPrompt += `\n🎚️ CURRENT STUDIO CONTEXT\n${summarizedTracks}\nEnsure the new material complements these tracks without clashing.`;
  }

  // Add a unique variation seed so the AI never gets the exact same prompt twice
  const variationSeed = Date.now() ^ Math.floor(Math.random() * 1000000);
  const variationAdjectives = [
    'fresh', 'unexpected', 'inventive', 'bold', 'experimental',
    'surprising', 'unconventional', 'creative', 'distinctive', 'original',
    'innovative', 'unique', 'imaginative', 'daring', 'inspired',
  ];
  const adj1 = variationAdjectives[variationSeed % variationAdjectives.length];
  const adj2 = variationAdjectives[(variationSeed * 7 + 3) % variationAdjectives.length];

  systemPrompt += `\n🎲 VARIATION DIRECTIVE (Seed: ${variationSeed})
This is generation #${variationSeed}. You MUST create something ${adj1} and ${adj2} — never repeat a previous pattern.
Vary the rhythm placement, note choices, chord inversions, and melodic contour.
Randomize which steps have hits, shift the groove, use different scale degrees for melody.
Do NOT fall back to the most common or obvious pattern for this genre.`;

  systemPrompt += `\n📦 OUTPUT: Return ONLY valid JSON. No markdown, no commentary. Use this structure (this is a FORMAT reference only — do NOT copy these specific notes or rhythms):
{
  "style":"${style}","bpm":140,"key":"Am","timeSignature":{"numerator":4,"denominator":4},
  "instruments":{"bass":"synth_bass_1","chords":"pad_2_warm","melody":"lead_2_sawtooth","drumKit":"808"},
  "drums":[
    {"step":0,"type":"kick","velocity":0.95},{"step":3,"type":"kick","velocity":0.55},
    {"step":4,"type":"snare","velocity":0.90},{"step":6,"type":"hihat","velocity":0.40},
    {"step":8,"type":"kick","velocity":0.88},{"step":10,"type":"hihat","velocity":0.30},
    {"step":11,"type":"kick","velocity":0.50},{"step":12,"type":"snare","velocity":0.92},
    {"step":14,"type":"hihat","velocity":0.35},{"step":15,"type":"perc","velocity":0.28},
    {"step":16,"type":"kick","velocity":0.95},{"step":18,"type":"hihat","velocity":0.42},
    {"step":20,"type":"snare","velocity":0.88},{"step":22,"type":"hihat","velocity":0.32},
    {"step":24,"type":"kick","velocity":0.80},{"step":27,"type":"kick","velocity":0.48},
    {"step":28,"type":"snare","velocity":0.90},{"step":30,"type":"hihat","velocity":0.38},
    {"step":32,"type":"kick","velocity":0.95},{"step":34,"type":"hihat","velocity":0.28},
    {"step":36,"type":"snare","velocity":0.85},{"step":38,"type":"perc","velocity":0.30},
    {"step":40,"type":"kick","velocity":0.72},{"step":42,"type":"hihat","velocity":0.45},
    {"step":44,"type":"snare","velocity":0.92},{"step":46,"type":"hihat","velocity":0.22}
  ],
  "bass":[
    {"step":0,"note":33,"duration":3,"velocity":0.92},{"step":3,"note":33,"duration":1,"velocity":0.65},
    {"step":6,"note":36,"duration":2,"velocity":0.80},{"step":10,"note":35,"duration":2,"velocity":0.75},
    {"step":16,"note":33,"duration":4,"velocity":0.90},{"step":22,"note":31,"duration":2,"velocity":0.70},
    {"step":26,"note":33,"duration":2,"velocity":0.85},{"step":32,"note":36,"duration":3,"velocity":0.88},
    {"step":37,"note":35,"duration":3,"velocity":0.72},{"step":42,"note":33,"duration":4,"velocity":0.90},
    {"step":48,"note":31,"duration":2,"velocity":0.78},{"step":52,"note":33,"duration":4,"velocity":0.85}
  ],
  "chords":[
    {"step":0,"notes":[57,60,64],"duration":16,"velocity":0.65},
    {"step":16,"notes":[55,59,62],"duration":8,"velocity":0.60},
    {"step":24,"notes":[53,57,60],"duration":8,"velocity":0.62},
    {"step":32,"notes":[52,55,59],"duration":16,"velocity":0.68},
    {"step":48,"notes":[57,60,64],"duration":16,"velocity":0.58}
  ],
  "melody":[
    {"step":0,"note":69,"duration":2,"velocity":0.88},{"step":3,"note":72,"duration":1,"velocity":0.70},
    {"step":5,"note":71,"duration":3,"velocity":0.82},{"step":10,"note":69,"duration":2,"velocity":0.75},
    {"step":14,"note":67,"duration":2,"velocity":0.78},{"step":18,"note":69,"duration":3,"velocity":0.85},
    {"step":22,"note":71,"duration":2,"velocity":0.72},{"step":26,"note":72,"duration":4,"velocity":0.90},
    {"step":32,"note":74,"duration":2,"velocity":0.80},{"step":36,"note":72,"duration":2,"velocity":0.68},
    {"step":40,"note":69,"duration":3,"velocity":0.85},{"step":45,"note":67,"duration":3,"velocity":0.75}
  ]
}
RULES:
- steps 0-63 (4 bars × 16 steps per bar)
- drums: "type" must be kick/snare/hihat/perc — include "velocity" (0.1-1.0) on every hit
- bass/melody: MIDI "note" (28-96), "duration" (steps), "velocity" (0.1-1.0) on every note
- chords: "notes" array of MIDI values, "duration", "velocity" on every chord
- MINIMUM COUNTS: 24 drum hits across all 4 types, 12 bass notes, 5 chords, 12 melody notes
- Vary velocity meaningfully — downbeats louder, ghost notes soft (0.15-0.35), accents strong (0.85-1.0)
- Distribute hits across all 64 steps — do not cluster everything in steps 0-16
- The FORMAT above is structural reference only. Generate completely original rhythm, notes, and placement for "${style}"`;

  const timeSigLine = options.timeSignature
    ? ` Keep the rhythm feeling ${options.timeSignature.numerator}/${options.timeSignature.denominator}.`
    : '';
  const tempoLine = options.tempo ? ` Match the exact tempo ${options.tempo} BPM.` : '';
  const userPrompt = `Generate a ${adj1}, ${adj2} ${style} beat that sounds different from anything generated before (variation ${variationSeed}).${tempoLine}${timeSigLine} ${safePrompt}`.trim();

  return {
    systemPrompt,
    userPrompt,
    metadata: {
      style,
      genreName: genreSpec?.name,
      hasInsights: Boolean(insights),
      progressionCount: progressions.length,
      tempo: options.tempo,
      timeSignature: options.timeSignature,
      key: options.key,
      trackSummaryCount: options.tracks?.length,
    },
  };
}
