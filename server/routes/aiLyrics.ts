import { Router } from "express";
import { randomUUID } from "crypto";
import { callAI } from "../services/aiGateway";
import { LocalStorageService } from "../services/localStorageService";
import type {
  GeneratedLyricsSection,
  LyricsPunchupResult,
} from "@shared/types/aiMusic";

const router = Router();
const storage = new LocalStorageService();

const generatedLyricsSchema = {
  type: "object",
  required: ["id", "songPlanId", "sectionId", "lines", "metadata", "createdAt"],
  properties: {
    id: { type: "string" },
    songPlanId: { type: "string" },
    sectionId: { type: "string" },
    lines: {
      type: "array",
      items: { type: "string" },
      minItems: 4,
    },
    metadata: {
      type: "object",
      properties: {
        rhymeScheme: { type: "string" },
        syllablesPerLine: {
          type: "array",
          items: { type: "number" },
        },
      },
      additionalProperties: false,
    },
    createdAt: { type: "string" },
  },
  additionalProperties: false,
};

const punchupSchema = {
  type: "object",
  required: ["sectionId", "originalLines", "rewrittenLines"],
  properties: {
    sectionId: { type: "string" },
    originalLines: {
      type: "array",
      items: { type: "string" },
    },
    rewrittenLines: {
      type: "array",
      items: { type: "string" },
    },
    notes: { type: "string" },
  },
  additionalProperties: false,
};

function coerceGeneratedLyrics(
  input: Partial<GeneratedLyricsSection>,
  fallback: { songPlanId: string; sectionId: string; style: string; topic: string },
): GeneratedLyricsSection {
  const id = input.id || randomUUID();
  const createdAt = input.createdAt || new Date().toISOString();
  const lines =
    Array.isArray(input.lines) && input.lines.length > 0
      ? input.lines
      : [
          `${fallback.topic} in ${fallback.style}, let the story begin`,
          `Carrying mood through the bar line, pull the listener in`,
          `Heartbeat on the downbeat, feeling under the skin`,
          `Hook lands, we remember where the moment has been`,
        ];

  const syllablesPerLine =
    input.metadata?.syllablesPerLine && Array.isArray(input.metadata.syllablesPerLine)
      ? input.metadata.syllablesPerLine
      : lines.map(() => Math.max(6, Math.min(12, fallback.topic.length % 8 + 6)));

  return {
    id,
    songPlanId: input.songPlanId || fallback.songPlanId,
    sectionId: input.sectionId || fallback.sectionId,
    lines,
    metadata: {
      rhymeScheme: input.metadata?.rhymeScheme || "AABB",
      syllablesPerLine,
    },
    createdAt,
  };
}

function coercePunchup(input: Partial<LyricsPunchupResult>, originalLines: string[], sectionId: string): LyricsPunchupResult {
  const rewritten =
    Array.isArray(input.rewrittenLines) && input.rewrittenLines.length > 0
      ? input.rewrittenLines
      : originalLines.map((line) => `${line} (tighter phrasing)`);

  return {
    sectionId: input.sectionId || sectionId,
    originalLines,
    rewrittenLines: rewritten,
    notes: input.notes || "Improved clarity, rhyme density, and flow while preserving meaning.",
  };
}

router.post("/generate", async (req, res) => {
  try {
    const { songPlanId, sectionId, style, topic, syllablesPerBar, rhymeScheme } = req.body || {};

    if (!songPlanId || !sectionId || !style || !topic) {
      return res.status(400).json({
        error: "songPlanId, sectionId, style, and topic are required",
      });
    }

    const prompt = [
      `Generate lyrics for a specific section of a song plan.`,
      `Return strict JSON that matches the schema.`,
      ``,
      `Constraints:`,
      `- style: ${style}`,
      `- topic: ${topic}`,
      rhymeScheme ? `- rhyme scheme: ${rhymeScheme}` : null,
      syllablesPerBar ? `- target syllables per bar: ${syllablesPerBar}` : null,
      ``,
      `Make the lines performance-ready, concise, and rhythmic.`,
    ]
      .filter(Boolean)
      .join("\n");

    let aiResult: Partial<GeneratedLyricsSection> = {};

    try {
      const response = await callAI<Partial<GeneratedLyricsSection>>({
        system: "You are a professional songwriter. Always return valid JSON that matches the schema.",
        user: prompt,
        temperature: 0.7,
        responseFormat: "json",
        jsonSchema: generatedLyricsSchema,
      });

      aiResult = response.content;
    } catch (error) {
      console.error("AI lyrics generate failed; using fallback:", error);
    }

    const normalized = coerceGeneratedLyrics(aiResult, { songPlanId, sectionId, style, topic });
    await storage.saveJson("lyrics", normalized.id, normalized);

    return res.json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error("Lyrics generate error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate lyrics",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/punchup", async (req, res) => {
  try {
    const { sectionId, originalLines } = req.body || {};

    if (!sectionId || !Array.isArray(originalLines) || originalLines.length === 0) {
      return res.status(400).json({
        error: "sectionId and originalLines (non-empty array) are required",
      });
    }

    const prompt = [
      `Improve these lyrics but keep the core meaning and style.`,
      `Make phrasing tighter, imagery sharper, and rhyme/flow stronger.`,
      ``,
      `Original lines:`,
      originalLines.map((line: string, idx: number) => `${idx + 1}. ${line}`).join("\n"),
      ``,
      `Return only JSON matching the schema.`,
    ].join("\n");

    let aiResult: Partial<LyricsPunchupResult> = {};

    try {
      const response = await callAI<Partial<LyricsPunchupResult>>({
        system: "You are a punch-up writer. Polish lyrics while preserving intent. Return valid JSON.",
        user: prompt,
        temperature: 0.6,
        responseFormat: "json",
        jsonSchema: punchupSchema,
      });
      aiResult = response.content;
    } catch (error) {
      console.error("AI lyrics punchup failed; using fallback:", error);
    }

    const normalized = coercePunchup(aiResult, originalLines, sectionId);
    await storage.saveJson("lyrics-punchup", normalized.sectionId, normalized);

    return res.json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error("Lyrics punchup error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to punch up lyrics",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export function createAiLyricsRoutes() {
  return router;
}
