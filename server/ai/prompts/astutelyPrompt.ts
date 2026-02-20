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

  systemPrompt += `\n📦 OUTPUT: Return ONLY valid JSON. No markdown, no commentary. Copy this structure exactly:
{
  "style":"${style}","bpm":120,"key":"C","timeSignature":{"numerator":4,"denominator":4},
  "instruments":{"bass":"electric_bass_finger","chords":"acoustic_grand_piano","melody":"flute","drumKit":"default"},
  "drums":[
    {"step":0,"type":"kick"},{"step":4,"type":"snare"},{"step":8,"type":"kick"},{"step":12,"type":"snare"},
    {"step":2,"type":"hihat"},{"step":6,"type":"hihat"},{"step":10,"type":"hihat"},{"step":14,"type":"hihat"}
  ],
  "bass":[
    {"step":0,"note":36,"duration":4},{"step":8,"note":38,"duration":4},
    {"step":16,"note":36,"duration":4},{"step":24,"note":41,"duration":4}
  ],
  "chords":[
    {"step":0,"notes":[60,64,67],"duration":16},{"step":16,"notes":[65,69,72],"duration":16},
    {"step":32,"notes":[67,71,74],"duration":16},{"step":48,"notes":[60,64,67],"duration":16}
  ],
  "melody":[
    {"step":0,"note":72,"duration":2},{"step":4,"note":74,"duration":2},
    {"step":8,"note":76,"duration":4},{"step":16,"note":79,"duration":2}
  ]
}
RULES: steps 0-63 (4 bars × 16 steps). drums use "type" (kick/snare/hihat/perc). bass/melody use MIDI "note" (36-96) + "duration". chords use "notes" array of MIDI values + "duration". Generate at least 16 drum hits, 8 bass notes, 4 chords, 8 melody notes. Match the user's instrument requests.`;

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
