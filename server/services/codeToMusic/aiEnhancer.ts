/**
 * AI-Enhanced Code-to-Music Generator
 * Uses OpenAI/Grok to generate better chord progressions, melodies, and musical elements
 */

import OpenAI from 'openai';
import type { ParsedCode } from '../../../shared/types/codeToMusic';

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const xaiApiKey = process.env.XAI_API_KEY;

let openaiClient: OpenAI | null = null;
let grokClient: OpenAI | null = null;

if (openaiApiKey && openaiApiKey.startsWith('sk-')) {
  openaiClient = new OpenAI({ apiKey: openaiApiKey, timeout: 30000 });
}

if (xaiApiKey) {
  grokClient = new OpenAI({
    apiKey: xaiApiKey,
    baseURL: "https://api.x.ai/v1",
    timeout: 30000
  });
}

export interface AIEnhancedMusic {
  chords: Array<{
    chord: string;
    duration: number;
    start: number;
  }>;
  melody: Array<{
    note: string;
    octave: number;
    start: number;
    duration: number;
    velocity: number;
  }>;
  bassline: Array<{
    note: string;
    octave: number;
    start: number;
    duration: number;
  }>;
  suggestions: {
    mood: string;
    energy: string;
    musicalStyle: string;
  };
}

function getClient() {
  if (grokClient) return { client: grokClient, model: "grok-beta" };
  if (openaiClient) return { client: openaiClient, model: "gpt-4" };
  return null;
}

export function isAIAvailable(): boolean {
  return getClient() !== null;
}

export async function enhanceCodeToMusic(
  parsedCode: ParsedCode,
  genre: string,
  bpm: number,
  variation: number = 1,
  qualityMode: 'creative' | 'stable' = 'stable'
): Promise<AIEnhancedMusic | null> {
  const clientInfo = getClient();
  if (!clientInfo) {
    console.log('⚠️ No AI client available for code-to-music enhancement');
    return null;
  }

  const { client, model } = clientInfo;
  
  const elementTypes = parsedCode.elements.map(e => e.type);
  const typeDistribution = {
    classes: elementTypes.filter(t => t === 'class').length,
    functions: elementTypes.filter(t => t === 'function').length,
    loops: elementTypes.filter(t => t === 'loop').length,
    conditionals: elementTypes.filter(t => t === 'conditional').length,
    variables: elementTypes.filter(t => t === 'variable').length,
    imports: elementTypes.filter(t => t === 'import').length,
  };

  const codeAnalysis = {
    complexity: parsedCode.complexity,
    mood: parsedCode.mood || 'neutral',
    elementCount: parsedCode.elements.length,
    typeDistribution,
    nestingDepth: Math.max(...parsedCode.elements.map(e => e.nestingLevel), 0),
  };

  // Calculate beat duration for timing guidance
  const beatDuration = 60 / bpm;
  const barDuration = beatDuration * 4;
  const totalBars = 4;
  const totalDuration = barDuration * totalBars;

  const prompt = `You are a professional music composer specializing in ${genre}. Convert code structure analysis into a musical composition.

CODE STRUCTURE:
- Complexity: ${codeAnalysis.complexity}/10
- Mood detected: ${codeAnalysis.mood}
- Total elements: ${codeAnalysis.elementCount}
- Classes: ${typeDistribution.classes} (→ layered orchestration, new sections)
- Functions: ${typeDistribution.functions} (→ distinct melodic phrases)
- Loops: ${typeDistribution.loops} (→ repetitive/ostinato patterns)
- Conditionals: ${typeDistribution.conditionals} (→ tension/resolution, call-and-response)
- Variables: ${typeDistribution.variables} (→ harmonic color changes)
- Nesting depth: ${codeAnalysis.nestingDepth} (→ harmonic complexity level)

MUSICAL CONSTRAINTS:
- Genre: ${genre}
- BPM: ${bpm} (beat = ${beatDuration.toFixed(3)}s, bar = ${barDuration.toFixed(3)}s)
- Total duration: ${totalDuration.toFixed(1)}s (${totalBars} bars)
- Variation seed: ${variation}

COMPOSITION RULES:
1. Chords MUST align to bar boundaries (start at multiples of ${barDuration.toFixed(3)})
2. Melody notes MUST land on chord tones on strong beats (beats 1 and 3)
3. Passing tones allowed on weak beats (beats 2 and 4)
4. Bass follows chord roots with genre-appropriate rhythm
5. Complexity ${codeAnalysis.complexity}/10 → ${codeAnalysis.complexity <= 3 ? 'simple triads, stepwise melody' : codeAnalysis.complexity <= 6 ? '7th chords, moderate leaps' : 'extended chords (9ths/11ths), wide intervals, chromatic passing tones'}
6. Mood "${codeAnalysis.mood}" → ${codeAnalysis.mood === 'happy' ? 'major keys, ascending phrases' : codeAnalysis.mood === 'sad' ? 'minor keys, descending phrases, slower rhythm' : codeAnalysis.mood === 'energetic' ? 'driving rhythm, syncopation, wider range' : 'balanced dynamics, moderate movement'}

Generate JSON with:
1. "chords": Array of ${totalBars}-8 chords: { "chord": "Am7", "duration": ${barDuration.toFixed(3)}, "start": 0.0 }
2. "melody": Array of ${Math.max(8, codeAnalysis.elementCount)}-${Math.min(32, codeAnalysis.elementCount * 3)} notes: { "note": "C", "octave": 4, "start": 0.0, "duration": ${(beatDuration * 0.5).toFixed(3)}, "velocity": 0.8 }
3. "bassline": Array of ${totalBars * 2}-${totalBars * 4} bass notes: { "note": "C", "octave": 2, "start": 0.0, "duration": ${beatDuration.toFixed(3)} }
4. "suggestions": { "mood": "description", "energy": "low/medium/high", "musicalStyle": "description" }

Return ONLY valid JSON.`;

  // Temperature: stable mode = tighter, creative mode = more variation
  const temperature = qualityMode === 'creative'
    ? Math.min(1.2, 0.8 + (variation * 0.1))
    : Math.min(0.8, 0.5 + (variation * 0.05));

  try {
    console.log(`🎵 AI enhancing code-to-music: ${genre} at ${bpm} BPM (${qualityMode} mode)`);
    
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a music theory expert and professional composer. Return only valid JSON. All timing values must be in seconds. Ensure chord tones align with melody on strong beats." },
        { role: "user", content: prompt }
      ],
      temperature,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('❌ Empty AI response');
      return null;
    }

    const result = JSON.parse(content) as AIEnhancedMusic;
    
    if (!result.chords || !result.melody) {
      console.error('❌ Invalid AI response structure');
      return null;
    }

    console.log(`✅ AI generated: ${result.chords.length} chords, ${result.melody.length} melody notes, ${result.bassline?.length || 0} bass notes`);
    
    return result;
  } catch (error) {
    console.error('❌ AI enhancement failed:', error);
    return null;
  }
}
