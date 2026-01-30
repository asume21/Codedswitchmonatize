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

  systemPrompt += `\n📦 OUTPUT FORMAT
Return JSON only with fields: style, bpm, key, timeSignature, drums[], bass[], chords[], melody[]. Use 64 steps. No commentary.`;

  const timeSigLine = options.timeSignature
    ? ` Keep the rhythm feeling ${options.timeSignature.numerator}/${options.timeSignature.denominator}.`
    : '';
  const tempoLine = options.tempo ? ` Match the exact tempo ${options.tempo} BPM.` : '';
  const userPrompt = `Generate a ${style} beat.${tempoLine}${timeSigLine} ${safePrompt}`.trim();

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
