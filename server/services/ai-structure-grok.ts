import OpenAI from "openai";
import { getAIClient } from "./grok";
import { getKeySpecificChordProgression } from "./chord-progressions";

export interface SongSection {
  duration: number;
  measures: number;
  instruments: string[];
  vocals?: boolean;
  dynamics: string;
  tempo?: number;
  key?: string;
  description: string;
}

export interface SongStructure {
  [sectionName: string]: SongSection;
}

export interface GeneratedSongData {
  structure: SongStructure;
  metadata: {
    title: string;
    artist: string;
    genre: string;
    bpm: number;
    key: string;
    duration: string; // mm:ss
    format: string;
  };
  chordProgression: string[] | string;
  productionNotes: {
    mixing: string;
    mastering: string;
    effects: string;
    genre: string;
    style: string;
    professionalGrade: boolean;
  };
  audioFeatures: {
    realtimePlayback: boolean;
    professionalMixing: boolean;
    spatialAudio: boolean;
    vocalTuning: boolean;
    instrumentLayers: number;
  };
}

function getAiClient(provider?: string) {
  if ((provider || "").toLowerCase() === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("OPENAI_API_KEY not configured");
    return new OpenAI({ apiKey: key });
  }
  // default to xAI Grok - use the client from grok.ts
  const xaiClient = getAIClient();
  if (!xaiClient) throw new Error("xAI Grok client not available");
  return xaiClient;
}

export async function generateSongStructureWithAI(
  prompt: string,
  genre: string = "Electronic",
  bpm: number = 120,
  provider?: string,
  key: string = "C Major"
): Promise<GeneratedSongData> {
  const client = getAiClient(provider);

  const system = `You are a professional music producer and arranger. Generate studio-grade COMPLETE song structures as strict JSON.`;
  const user = `Create a complete professional song structure for: "${prompt}"

Genre: ${genre}
BPM: ${bpm}
Key: ${key}

Return STRICT JSON with exactly these top-level keys:
{
  "structure": {
    "intro": {"duration": 16, "measures": 4, "instruments": ["piano", "strings"], "dynamics": "soft", "tempo": ${bpm}, "key": "${key}", "description": "..."},
    "verse1": {"duration": 32, "measures": 8, "instruments": ["piano","guitar","bass","drums"], "vocals": true, "dynamics": "moderate", "description": "..."},
    "chorus": {"duration": 24, "measures": 6, "instruments": ["full_band"], "vocals": true, "dynamics": "powerful", "description": "..."}
  },
  "metadata": {
    "title": "Generated Song Title",
    "artist": "AI Composer",
    "genre": "${genre}",
    "bpm": ${bpm},
    "key": "${key}",
    "duration": "3:30",
    "format": "WAV"
  },
  "chordProgression": ${JSON.stringify(getKeySpecificChordProgression(key, genre).split(' - '))},
  "productionNotes": {
    "mixing": "Professional stereo balance with spatial positioning",
    "mastering": "Commercial loudness standards (-14 LUFS integrated)",
    "effects": "Studio-grade reverb, compression, and EQ",
    "genre": "${genre}",
    "style": "modern",
    "professionalGrade": true
  },
  "audioFeatures": {
    "realtimePlayback": true,
    "professionalMixing": true,
    "spatialAudio": true,
    "vocalTuning": true,
    "instrumentLayers": 5
  }
}

Requirements:
- 5-8 sections (intro, verse, chorus, bridge, outro variations)
- Realistic durations/measures and detailed descriptions
- Instruments appropriate for ${genre}
- Professional dynamics arc
- Chord progression in ${key} matching ${genre} style
- VALID JSON ONLY.`;

  const aiTimeoutMs = parseInt(process.env.XAI_TIMEOUT_MS || "28000", 10);

  const aiCall = client.chat.completions.create({
    model: (provider || "").toLowerCase() === "openai" ? "gpt-4o" : "grok-2-1212",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 3000,
  } as any);

  const response: any = await Promise.race([
    aiCall,
    new Promise((_, reject) => setTimeout(() => reject(new Error("AI generation timed out")), aiTimeoutMs)),
  ]);

  const raw = response?.choices?.[0]?.message?.content as string | undefined;
  if (!raw) throw new Error("Empty AI response");

  // Clean and parse JSON
  let text = raw
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/```json\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start > 0 || end !== text.length - 1) {
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }

  const data = JSON.parse(text) as GeneratedSongData;
  if (!data || !data.structure || !data.metadata) {
    throw new Error("Invalid AI structure format");
  }
  return data;
}
