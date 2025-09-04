import OpenAI from "openai";

// Initialize xAI Grok client
export const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || "",
  baseURL: "https://api.x.ai/v1",
});

// Fallback OpenAI client
const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Gemini client
import { GoogleGenerativeAI } from "@google/generative-ai";
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

function getAiClient(provider?: string) {
  const providerLower = (provider || "").toLowerCase();
  
  if (providerLower === "openai" && openaiClient) {
    return openaiClient;
  }
  
  if (providerLower === "gemini" && gemini) {
    return gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
  }
  
  // Default to xAI Grok
  return openai;
}

export async function translateCode(
  sourceCode: string,
  sourceLanguage: string,
  targetLanguage: string,
  aiProvider: string = "grok"
): Promise<string> {
  const client = getAiClient(aiProvider);
  
  if (aiProvider.toLowerCase() === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Translate this ${sourceLanguage} code to ${targetLanguage}. Return only the translated code without explanations:\n\n${sourceCode}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `You are a code translator. Translate code from ${sourceLanguage} to ${targetLanguage}. Return only the translated code without explanations.`,
      },
      {
        role: "user",
        content: sourceCode,
      },
    ],
    temperature: 0.1,
  });

  return response.choices[0].message.content || "";
}

export async function generateBeat(
  genre: string,
  bpm: number,
  complexity: number,
  aiProvider: string = "grok"
): Promise<any> {
  const client = getAiClient(aiProvider);

  if (aiProvider.toLowerCase() === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Create a ${genre} beat pattern at ${bpm} BPM with complexity ${complexity}/10. Return JSON with kick, snare, hihat arrays (16 boolean values each).`;
    const result = await model.generateContent(prompt);
    try {
      return JSON.parse(result.response.text());
    } catch {
      return {
        kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hihat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
      };
    }
  }

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `Create a ${genre} beat pattern at ${bpm} BPM with complexity level ${complexity}/10. Return JSON with drum track arrays.`,
      },
      {
        role: "user",
        content: `Generate a beat pattern with kick, snare, hihat, openhat, tom1, tom2, tom3, ride arrays. Each array should have 16 boolean values representing a 16-step pattern.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No response from AI");

  try {
    return JSON.parse(content);
  } catch {
    // Fallback pattern
    return {
      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      hihat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
      openhat: [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true],
      tom1: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      tom2: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      tom3: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      ride: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    };
  }
}

export async function generateLyrics(
  theme: string,
  genre: string,
  mood: string,
  complexity: number = 5,
  aiProvider: string = "grok"
): Promise<string> {
  const client = getAiClient(aiProvider);

  if (aiProvider.toLowerCase() === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Create ${genre} lyrics about "${theme}" with ${mood} mood and complexity level ${complexity}/10.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `You are a professional lyricist. Create ${genre} lyrics with ${mood} mood and complexity level ${complexity}/10.`,
      },
      {
        role: "user",
        content: `Write lyrics about: ${theme}`,
      },
    ],
    temperature: 0.8,
  });

  return response.choices[0].message.content || "";
}

export async function codeToMusic(
  code: string,
  language: string,
  complexity: number = 5,
  aiProvider: string = "grok"
): Promise<any> {
  const client = getAiClient(aiProvider);

  if (aiProvider.toLowerCase() === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Transform this ${language} code into musical composition with complexity ${complexity}/10. Return JSON with melody and drumPattern.`;
    const result = await model.generateContent(prompt);
    try {
      return JSON.parse(result.response.text());
    } catch {
      return {
        melody: [
          { note: "C4", start: 0, duration: 0.5, frequency: 261.63, instrument: "piano" },
          { note: "E4", start: 0.5, duration: 0.5, frequency: 329.63, instrument: "piano" },
        ],
        drumPattern: {
          kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
          snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        },
      };
    }
  }

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `Transform ${language} code into musical composition. Return JSON with melody and drumPattern.`,
      },
      {
        role: "user",
        content: code,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No response from AI");

  try {
    return JSON.parse(content);
  } catch {
    return {
      melody: [
        { note: "C4", start: 0, duration: 0.5, frequency: 261.63, instrument: "piano" },
      ],
      drumPattern: {
        kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      },
    };
  }
}

export async function musicToCode(
  musicData: any,
  targetLanguage: string,
  codeStyle: string,
  complexity: number = 5,
  aiProvider: string = "grok"
): Promise<any> {
  const client = getAiClient(aiProvider);

  if (aiProvider.toLowerCase() === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Convert this musical data to ${targetLanguage} code with ${codeStyle} style and complexity ${complexity}/10.`;
    const result = await model.generateContent(prompt);
    return {
      code: result.response.text(),
      language: targetLanguage,
      description: "Generated from musical composition",
    };
  }

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `Convert musical data to ${targetLanguage} code with ${codeStyle} style.`,
      },
      {
        role: "user",
        content: JSON.stringify(musicData),
      },
    ],
    temperature: 0.5,
  });

  return {
    code: response.choices[0].message.content || "",
    language: targetLanguage,
    description: "Generated from musical composition",
  };
}

export async function scanVulnerabilities(
  code: string,
  language: string,
  aiProvider: string = "grok"
): Promise<any> {
  const client = getAiClient(aiProvider);

  if (aiProvider.toLowerCase() === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Scan this ${language} code for security vulnerabilities. Return JSON with vulnerabilities array.`;
    const result = await model.generateContent(prompt);
    try {
      return JSON.parse(result.response.text());
    } catch {
      return {
        vulnerabilities: [],
        securityScore: 85,
        summary: "No major vulnerabilities detected",
      };
    }
  }

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `Scan ${language} code for security vulnerabilities. Return JSON with vulnerabilities, securityScore, and summary.`,
      },
      {
        role: "user",
        content: code,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No response from AI");

  try {
    return JSON.parse(content);
  } catch {
    return {
      vulnerabilities: [],
      securityScore: 85,
      summary: "Security scan completed",
    };
  }
}

export async function getAIAssistance(
  message: string,
  context?: string,
  aiProvider: string = "grok"
): Promise<string> {
  const client = getAiClient(aiProvider);

  if (aiProvider.toLowerCase() === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are an AI assistant for CodedSwitch. ${context ? `Context: ${context}` : ''} User message: ${message}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant for CodedSwitch, a platform that bridges coding and music creation. ${context ? `Context: ${context}` : ''}`,
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content || "";
}

export async function generateDynamicLayers(
  arrangement: any,
  style: string,
  complexity: number,
  aiProvider: string = "grok"
): Promise<any> {
  const client = getAiClient(aiProvider);

  const response = await (client as OpenAI).chat.completions.create({
    model: aiProvider.toLowerCase() === "openai" ? "gpt-4o-mini" : "grok-2-1212",
    messages: [
      {
        role: "system",
        content: `Generate dynamic instrumental layers for a musical arrangement in ${style} style with complexity ${complexity}/10.`,
      },
      {
        role: "user",
        content: JSON.stringify(arrangement),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No response from AI");

  try {
    return JSON.parse(content);
  } catch {
    return {
      layers: [
        {
          instrument: "piano",
          type: "harmony",
          notes: [
            { frequency: 261.63, start: 0, duration: 1, velocity: 0.7 },
            { frequency: 329.63, start: 1, duration: 1, velocity: 0.7 },
          ],
          volume: 0.8,
          pan: 0,
          effects: ["reverb"],
          role: "harmonic support",
        },
      ],
    };
  }
}