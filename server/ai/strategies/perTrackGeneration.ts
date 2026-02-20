// server/ai/strategies/perTrackGeneration.ts
// Per-track generation strategy for small AI models like Phi3.
// Instead of asking the model to generate all 4 tracks in one massive JSON,
// we ask it for one track at a time — a much simpler task that small models handle well.

import { makeLocalAICall } from '../../services/localAI';
import { makeAICall } from '../../services/grok';
import { extractJSON } from '../utils/robustJsonParser';
import { astutelyDiagnostics } from '../../services/astutelyDiagnostics';

export interface PerTrackResult {
  drums: any[];
  bass: any[];
  chords: any[];
  melody: any[];
  bpm: number;
  key: string;
  style: string;
  instruments: { bass: string; chords: string; melody: string; drumKit: string };
  tracksFromAI: string[];
  tracksFailed: string[];
}

interface TrackSpec {
  name: 'drums' | 'bass' | 'chords' | 'melody';
  systemPrompt: string;
  userPrompt: string;
  minItems: number;
}

function buildDrumPrompt(style: string, bpm: number, key: string, userHint: string): TrackSpec {
  return {
    name: 'drums',
    minItems: 8,
    systemPrompt: `You generate drum patterns as JSON arrays. Output ONLY a JSON array, no other text.
Each element: {"step":N,"type":"kick"|"snare"|"hihat"|"perc"} where step is 0-63 (4 bars × 16 steps).
Example: [{"step":0,"type":"kick"},{"step":4,"type":"snare"},{"step":8,"type":"kick"},{"step":12,"type":"snare"},{"step":2,"type":"hihat"},{"step":6,"type":"hihat"},{"step":10,"type":"hihat"},{"step":14,"type":"hihat"}]`,
    userPrompt: `Generate a ${style} drum pattern at ${bpm} BPM. Make it groovy and interesting. ${userHint}. Return ONLY the JSON array.`,
  };
}

function buildBassPrompt(style: string, bpm: number, key: string, userHint: string): TrackSpec {
  return {
    name: 'bass',
    minItems: 4,
    systemPrompt: `You generate bass lines as JSON arrays. Output ONLY a JSON array, no other text.
Each element: {"step":N,"note":MIDI,"duration":D} where step is 0-63, note is MIDI number (28-48 range for bass), duration is 1-8.
Example: [{"step":0,"note":36,"duration":4},{"step":8,"note":38,"duration":4},{"step":16,"note":36,"duration":4},{"step":24,"note":41,"duration":4}]`,
    userPrompt: `Generate a ${style} bass line in the key of ${key} at ${bpm} BPM. ${userHint}. Return ONLY the JSON array.`,
  };
}

function buildChordPrompt(style: string, bpm: number, key: string, userHint: string): TrackSpec {
  return {
    name: 'chords',
    minItems: 2,
    systemPrompt: `You generate chord progressions as JSON arrays. Output ONLY a JSON array, no other text.
Each element: {"step":N,"notes":[MIDI,MIDI,MIDI],"duration":D} where step is 0-63, notes are MIDI numbers (48-84), duration is 4-16.
Example: [{"step":0,"notes":[60,64,67],"duration":16},{"step":16,"notes":[65,69,72],"duration":16},{"step":32,"notes":[67,71,74],"duration":16},{"step":48,"notes":[60,64,67],"duration":16}]`,
    userPrompt: `Generate a ${style} chord progression in ${key} at ${bpm} BPM. ${userHint}. Return ONLY the JSON array.`,
  };
}

function buildMelodyPrompt(style: string, bpm: number, key: string, userHint: string): TrackSpec {
  return {
    name: 'melody',
    minItems: 4,
    systemPrompt: `You generate melodies as JSON arrays. Output ONLY a JSON array, no other text.
Each element: {"step":N,"note":MIDI,"duration":D} where step is 0-63, note is MIDI number (60-84 for melody), duration is 1-8.
Example: [{"step":0,"note":72,"duration":2},{"step":4,"note":74,"duration":2},{"step":8,"note":76,"duration":4},{"step":16,"note":79,"duration":2},{"step":20,"note":77,"duration":2},{"step":24,"note":76,"duration":4}]`,
    userPrompt: `Generate a ${style} melody in ${key} at ${bpm} BPM. Make it memorable and singable. ${userHint}. Return ONLY the JSON array.`,
  };
}

async function generateSingleTrack(
  spec: TrackSpec,
  useLocal: boolean,
  requestId: string,
): Promise<{ data: any[] | null; fromAI: boolean }> {
  const callStart = Date.now();
  try {
    const messages = [
      { role: 'system' as const, content: spec.systemPrompt },
      { role: 'user' as const, content: spec.userPrompt },
    ];

    let response;
    if (useLocal) {
      response = await makeLocalAICall(messages, { format: 'json', temperature: 0.9 });
    } else {
      response = await makeAICall(messages, {
        response_format: { type: 'json_object' },
        temperature: 0.9,
      });
    }

    const rawContent = response.choices?.[0]?.message?.content || '';

    // Try parsing as array directly first
    let parsed: any = null;
    try {
      const direct = JSON.parse(rawContent.trim());
      if (Array.isArray(direct)) {
        parsed = direct;
      } else if (direct && typeof direct === 'object') {
        // AI might wrap in an object like { "drums": [...] } or { "data": [...] }
        const firstArrayKey = Object.keys(direct).find(k => Array.isArray(direct[k]));
        if (firstArrayKey) parsed = direct[firstArrayKey];
      }
    } catch {
      // Try robust extraction
      const extracted = extractJSON(rawContent);
      if (extracted.success) {
        if (Array.isArray(extracted.data)) {
          parsed = extracted.data;
        } else if (extracted.data && typeof extracted.data === 'object') {
          const firstArrayKey = Object.keys(extracted.data).find(k => Array.isArray(extracted.data[k]));
          if (firstArrayKey) parsed = extracted.data[firstArrayKey];
        }
      }
    }

    // Also try extracting array from brackets
    if (!parsed) {
      const bracketMatch = rawContent.match(/\[[\s\S]*\]/);
      if (bracketMatch) {
        try {
          parsed = JSON.parse(bracketMatch[0]);
        } catch {
          // Remove trailing commas and try again
          const cleaned = bracketMatch[0].replace(/,\s*([}\]])/g, '$1');
          try { parsed = JSON.parse(cleaned); } catch { /* give up */ }
        }
      }
    }

    if (Array.isArray(parsed) && parsed.length >= spec.minItems) {
      const provider = useLocal ? 'Phi3' : 'Grok';
      console.log(`  ✅ ${spec.name}: ${provider} returned ${parsed.length} events`);
      return { data: parsed, fromAI: true };
    }

    const durationMs = Date.now() - callStart;
    astutelyDiagnostics.log({
      severity: 'warn',
      category: 'validation',
      message: `Per-track ${spec.name}: got ${parsed?.length ?? 0} items (need ${spec.minItems})`,
      requestId,
      provider: useLocal ? 'Phi3 (Local)' : 'Grok-3 (Cloud)',
      durationMs,
      rawAIResponse: rawContent.slice(0, 500),
    });

    return { data: null, fromAI: false };
  } catch (err: any) {
    astutelyDiagnostics.log({
      severity: 'error',
      category: useLocal ? 'local_ai_call' : 'cloud_ai_call',
      message: `Per-track ${spec.name} failed: ${err.message}`,
      requestId,
      durationMs: Date.now() - callStart,
    });
    return { data: null, fromAI: false };
  }
}

export async function generatePerTrack(opts: {
  style: string;
  bpm: number;
  key: string;
  userHint: string;
  requestId: string;
  instruments: { bass: string; chords: string; melody: string; drumKit: string };
}): Promise<PerTrackResult> {
  const { style, bpm, key, userHint, requestId, instruments } = opts;

  const specs: TrackSpec[] = [
    buildDrumPrompt(style, bpm, key, userHint),
    buildBassPrompt(style, bpm, key, userHint),
    buildChordPrompt(style, bpm, key, userHint),
    buildMelodyPrompt(style, bpm, key, userHint),
  ];

  const result: PerTrackResult = {
    drums: [],
    bass: [],
    chords: [],
    melody: [],
    bpm,
    key,
    style,
    instruments,
    tracksFromAI: [],
    tracksFailed: [],
  };

  console.log(`🎯 Per-track generation: asking AI for each track individually...`);

  // Run all 4 tracks in parallel for speed — try local first
  const localResults = await Promise.all(
    specs.map(spec => generateSingleTrack(spec, true, requestId)),
  );

  // For any that failed locally, try cloud
  const cloudPromises: Promise<{ data: any[] | null; fromAI: boolean }>[] = [];
  const cloudIndices: number[] = [];

  localResults.forEach((lr, i) => {
    if (lr.data) {
      (result as any)[specs[i].name] = lr.data;
      result.tracksFromAI.push(specs[i].name);
    } else {
      cloudIndices.push(i);
      cloudPromises.push(generateSingleTrack(specs[i], false, requestId));
    }
  });

  if (cloudPromises.length > 0) {
    console.log(`  ☁️ ${cloudPromises.length} tracks failed locally, trying cloud...`);
    const cloudResults = await Promise.all(cloudPromises);
    cloudResults.forEach((cr, idx) => {
      const specIdx = cloudIndices[idx];
      if (cr.data) {
        (result as any)[specs[specIdx].name] = cr.data;
        result.tracksFromAI.push(specs[specIdx].name);
      } else {
        result.tracksFailed.push(specs[specIdx].name);
      }
    });
  }

  console.log(`🎯 Per-track result: AI generated [${result.tracksFromAI.join(', ')}], failed [${result.tracksFailed.join(', ') || 'none'}]`);

  return result;
}
