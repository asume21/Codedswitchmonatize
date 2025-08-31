import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not found. Gemini features will be disabled.");
}

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function translateCodeWithGemini(sourceCode: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
  if (!gemini) {
    throw new Error("Gemini API key not configured");
  }

  const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Translate the following ${sourceLanguage} code to ${targetLanguage}. 
  Maintain the same functionality and logic. Return only the translated code without explanations.
  
  Code:
  ${sourceCode}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateLyricsWithGemini(theme: string, genre: string, mood: string, complexity: number = 5): Promise<string> {
  if (!gemini) {
    throw new Error("Gemini API key not configured");
  }

  const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Create original ${genre} lyrics about "${theme}" with ${mood} mood and complexity level ${complexity}/10.
  
  Requirements:
  - Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple words, basic rhymes, straightforward themes' : complexity <= 6 ? 'Moderate vocabulary, some metaphors, varied rhyme schemes' : 'Advanced vocabulary, complex metaphors, intricate wordplay, layered meanings'}
  - Genre-appropriate language and imagery
  - Emotionally resonant and meaningful
  - Complete song structure with verses and chorus`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateBeatWithGemini(style: string, bpm: number, complexity: number = 5): Promise<any> {
  if (!gemini) {
    throw new Error("Gemini API key not configured");
  }

  const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Create a ${style} beat pattern at ${bpm} BPM with complexity level ${complexity}/10.

  Return JSON with kick, bass, tom, snare, hihat, openhat, clap, crash arrays (16 boolean values each).
  
  Requirements:
  - Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple, basic patterns' : complexity <= 6 ? 'Moderate complexity with some fills' : 'Complex patterns with advanced fills and syncopation'}
  - Musically interesting with proper spacing and groove
  - Genre-appropriate patterns for ${style}
  
  Example format:
  {
    "kick": [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
    "snare": [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
    "hihat": [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true]
  }`;

  const result = await model.generateContent(prompt);
  try {
    return JSON.parse(result.response.text());
  } catch {
    // Fallback pattern if JSON parsing fails
    return {
      kick: [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
      snare: [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
      hihat: [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
      bass: [true,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false],
      tom: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      openhat: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true],
      clap: [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      crash: [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]
    };
  }
}

export async function convertCodeToMusicWithGemini(code: string, language: string, complexity: number = 5): Promise<any> {
  if (!gemini) {
    throw new Error("Gemini API key not configured");
  }

  const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Transform this ${language} code into a musical composition with complexity level ${complexity}/10:

  Code:
  ${code}
  
  Requirements:
  - Map code elements to instruments: classes→piano, functions→violin/guitar, variables→bass, loops→drums
  - Return JSON with melody array and drumPattern object
  - Complexity ${complexity}/10: ${complexity <= 3 ? 'Simple melodies, basic drum patterns' : complexity <= 6 ? 'Moderate complexity with some harmonies' : 'Complex arrangements with multiple instruments and advanced rhythms'}
  
  Format:
  {
    "melody": [
      {"note": "C4", "start": 0, "duration": 0.5, "frequency": 261.63, "instrument": "piano"},
      {"note": "G3", "start": 0, "duration": 1.0, "frequency": 196.00, "instrument": "bass"}
    ],
    "drumPattern": {
      "kick": [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
      "snare": [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
      "hihat": [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true]
    },
    "title": "Code Symphony",
    "description": "Musical interpretation of the code structure"
  }`;

  const result = await model.generateContent(prompt);
  try {
    return JSON.parse(result.response.text());
  } catch {
    // Fallback composition if JSON parsing fails
    return {
      melody: [
        {note: "C4", start: 0, duration: 1.0, frequency: 261.63, instrument: "piano"},
        {note: "E4", start: 1.0, duration: 1.0, frequency: 329.63, instrument: "piano"},
        {note: "G4", start: 2.0, duration: 1.0, frequency: 392.00, instrument: "piano"},
        {note: "C5", start: 3.0, duration: 1.0, frequency: 523.25, instrument: "piano"}
      ],
      drumPattern: {
        kick: [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
        snare: [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
        hihat: [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false]
      },
      title: "Generated Code Music",
      description: "A simple musical interpretation"
    };
  }
}

export async function getAIAssistanceWithGemini(message: string, context?: string): Promise<string> {
  if (!gemini) {
    throw new Error("Gemini API key not configured");
  }

  const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `You are an AI assistant for CodedSwitch, a platform that bridges coding and music creation.
  
  ${context ? `Context: ${context}` : ''}
  
  User message: ${message}
  
  Provide helpful, informative responses about coding, music theory, or using the CodedSwitch platform features.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateSamplePacksWithGemini(prompt: string, count: number) {
  if (!gemini) {
    throw new Error("Gemini API key not configured");
  }

  const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

  const systemPrompt = `You are an expert music producer. Create ${count} unique sample pack concepts based on this prompt: ${prompt}
  
Return JSON with format: {"packs": [{"id": "string", "title": "string", "description": "string", "bpm": number, "key": "string", "genre": "string", "samples": [{"id": "string", "name": "string", "type": "loop|oneshot|midi", "duration": number}], "metadata": {"energy": number, "mood": "string", "instruments": ["array"], "tags": ["array"]}}]}`;

  const result = await model.generateContent(systemPrompt);
  const response = await result.response;
  const text = response.text();
  
  try {
    const parsed = JSON.parse(text);
    return parsed.packs || [];
  } catch {
    throw new Error("Failed to parse Gemini response");
  }
}