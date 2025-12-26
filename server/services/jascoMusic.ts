import fetch from "node-fetch";
import type { MusicPack as MusicGenPack, MusicSample as MusicGenSample } from "./unifiedMusicService";

interface JascoModelResponse {
  bpm?: number;
  key?: string;
  genre?: string;
  description?: string;
  chords?: string[];
  drums?: string[];
  melody?: string[];
}

const JASCO_MODEL = "Jasco/chords-drums-melody-1B";

export class JascoMusicService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || "";
    if (!this.apiKey) {
      console.warn("⚠️ HUGGINGFACE_API_KEY not set – Jasco provider will fall back to metadata packs");
    }
  }

  async generateSamplePack(prompt: string, count: number): Promise<MusicGenPack[]> {
    const packs: MusicGenPack[] = [];

    for (let i = 0; i < count; i++) {
      const variationPrompt = `${prompt} :: arrangement focus ${i + 1}`;
      try {
        if (!this.apiKey) {
          packs.push(this.buildFallbackPack(variationPrompt, i));
          continue;
        }

        const response = await this.queryModel(variationPrompt);
        packs.push(this.mapToPack(response, variationPrompt, i));
      } catch (error) {
        console.error("❌ Jasco generation failed – using fallback pack", error);
        packs.push(this.buildFallbackPack(variationPrompt, i));
      }
    }

    return packs;
  }

  private async queryModel(prompt: string): Promise<JascoModelResponse> {
    const response = await fetch(`https://api-inference.huggingface.co/models/${JASCO_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          return_full_text: false,
          temperature: 0.7,
        },
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || "Jasco API error");
    }

    try {
      return JSON.parse(text);
    } catch {
      // Some HF models return plain text; convert to simple description-only response
      return { description: text.trim() };
    }
  }

  private mapToPack(data: JascoModelResponse, prompt: string, index: number): MusicGenPack {
    const samples: MusicGenSample[] = [];

    if (data.chords?.length) {
      samples.push(this.createSample("Chord Progression", "midi", data.chords, index, 8));
    }

    if (data.drums?.length) {
      samples.push(this.createSample("Drum Pattern", "loop", data.drums, index, 4));
    }

    if (data.melody?.length) {
      samples.push(this.createSample("Lead Melody", "midi", data.melody, index, 8));
    }

    if (samples.length === 0) {
      samples.push(this.createSample("AI Arrangement", "midi", data.description ? [data.description] : [prompt], index, 8));
    }

    return {
      id: `jasco-pack-${Date.now()}-${index}`,
      title: data.description?.split("\n")[0]?.slice(0, 80) || `Jasco Arrangement #${index + 1}`,
      description: data.description || `AI arrangement generated for "${prompt}"`,
      bpm: data.bpm || 118 + index * 2,
      key: data.key || "C Minor",
      genre: data.genre || "Electronic",
      samples,
      metadata: {
        energy: 65 + (index * 5),
        mood: "Composed",
        instruments: ["AI Chords", "AI Melody", "AI Drums"],
        tags: ["Jasco", "Arrangement", "AI"],
      },
    };
  }

  private createSample(name: string, type: "loop" | "oneshot" | "midi", notes: string[], index: number, duration: number): MusicGenSample {
    return {
      id: `jasco-sample-${index}-${name.replace(/\s+/g, "-").toLowerCase()}`,
      name,
      prompt: name,
      duration,
      type,
      instrument: name.toLowerCase(),
      aiData: {
        notes,
        intensity: 0.5,
      },
    };
  }

  private buildFallbackPack(prompt: string, index: number): MusicGenPack {
    return {
      id: `jasco-fallback-${Date.now()}-${index}`,
      title: `Jasco Idea Pack #${index + 1}`,
      description: `Arrangement blueprint for ${prompt}`,
      bpm: 120,
      key: "C Major",
      genre: "Electronic",
      samples: [
        this.createSample("Chord Progression", "midi", ["Cmaj7", "Am7", "Dm7", "G7"], index, 8),
        this.createSample("Drum Pattern", "loop", ["KICK", "-", "SNARE", "-", "KICK", "-", "SNARE", "-"], index, 4),
        this.createSample("Lead Melody", "midi", ["E4", "G4", "A4", "G4"], index, 8),
      ],
      metadata: {
        energy: 60,
        mood: "Inspiring",
        instruments: ["Chords", "Drums", "Melody"],
        tags: ["Jasco", "Fallback", "Arrangement"],
      },
    };
  }
}

export const jascoMusicService = new JascoMusicService();
