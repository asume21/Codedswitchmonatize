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
  };
}

export function buildAstutelyPrompt(style: string, safePrompt: string): AstutelyPrompt {
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

  systemPrompt += `\n📦 OUTPUT FORMAT
Return JSON only with fields: style, bpm, key, drums[], bass[], chords[], melody[]. Use 64 steps. No commentary.`;

  const userPrompt = `Generate a ${style} beat. ${safePrompt}`;

  return {
    systemPrompt,
    userPrompt,
    metadata: {
      style,
      genreName: genreSpec?.name,
      hasInsights: Boolean(insights),
      progressionCount: progressions.length,
    },
  };
}
