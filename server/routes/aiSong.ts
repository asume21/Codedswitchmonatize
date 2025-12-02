import { Router } from "express";
import { randomUUID } from "crypto";
import { arrangeSong } from "../services/arrangement";
import { callAI } from "../services/aiGateway";
import { LocalStorageService } from "../services/localStorageService";
import type { SongPlan } from "@shared/types/aiMusic";

const router = Router();
const storage = new LocalStorageService();

// JSON schema used as guidance for SongPlan responses from AI
const songPlanSchema = {
  type: "object",
  required: [
    "bpm",
    "key",
    "timeSignature",
    "genre",
    "mood",
    "durationSeconds",
    "sections",
  ],
  properties: {
    bpm: { type: "number" },
    key: { type: "string" },
    timeSignature: { type: "string" },
    genre: { type: "string" },
    subGenre: { type: "string" },
    mood: { type: "string" },
    durationSeconds: { type: "number" },
    referenceArtists: {
      type: "array",
      items: { type: "string" },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "type", "bars"],
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          bars: { type: "number" },
        },
        additionalProperties: false,
      },
      minItems: 1,
    },
  },
  additionalProperties: true,
};

// Phase 1: turn a free-text idea into a structured SongPlan
router.post("/plan", async (req, res) => {
  try {
    const { idea, targetAudience, durationSeconds } = req.body || {};

    if (!idea || typeof idea !== "string" || !idea.trim()) {
      return res.status(400).json({
        success: false,
        error: "idea is required and must be a non-empty string",
      });
    }

    const targetDuration =
      typeof durationSeconds === "number" && durationSeconds > 0
        ? durationSeconds
        : 180;

    const system =
      "You are a professional songwriter and producer. You design complete song plans with realistic structure, tempo, key, and sections.";

    const userPrompt = [
      "Create a structured song plan from this idea.",
      "Return ONLY valid JSON that matches the SongPlan schema (no prose).",
      "",
      `Idea: ${idea}`,
      targetAudience ? `Target audience: ${targetAudience}` : null,
      `Target duration (seconds): ${targetDuration}`,
      "",
      "Include: bpm, key, timeSignature, genre, optional subGenre, mood, durationSeconds, sections with ids/types/bars, and optional referenceArtists.",
    ]
      .filter(Boolean)
      .join("\n");

    let aiPlan: Partial<SongPlan> = {};

    try {
      const response = await callAI<Partial<SongPlan>>({
        system,
        user: userPrompt,
        temperature: 0.6,
        responseFormat: "json",
        jsonSchema: songPlanSchema,
      });
      aiPlan = (response.content || {}) as Partial<SongPlan>;
    } catch (error) {
      console.error("AI song plan generation failed; using fallback:", error);
    }

    const now = new Date().toISOString();
    const id = aiPlan.id || randomUUID();

    const bpm = typeof aiPlan.bpm === "number" && aiPlan.bpm > 0 ? aiPlan.bpm : 140;
    const key = aiPlan.key || "C Minor";
    const timeSignature = aiPlan.timeSignature || "4/4";
    const genre = aiPlan.genre || "Hip-Hop";
    const mood = aiPlan.mood || "confident";
    const sections =
      Array.isArray(aiPlan.sections) && aiPlan.sections.length > 0
        ? aiPlan.sections
        : [
            { id: "intro", type: "intro", bars: 4 },
            { id: "hook1", type: "hook", bars: 8 },
            { id: "verse1", type: "verse", bars: 16 },
            { id: "hook2", type: "hook", bars: 8 },
            { id: "outro", type: "outro", bars: 4 },
          ];

    const plan: SongPlan = {
      id,
      bpm,
      key,
      timeSignature,
      genre,
      subGenre: aiPlan.subGenre,
      mood,
      durationSeconds: targetDuration,
      sections: sections.map((s, idx) => ({
        id: s.id || `${s.type || "section"}${idx + 1}`,
        type: s.type || "section",
        bars: typeof s.bars === "number" && s.bars > 0 ? s.bars : 8,
      })),
      referenceArtists: Array.isArray(aiPlan.referenceArtists)
        ? aiPlan.referenceArtists
        : undefined,
      createdAt: aiPlan.createdAt || now,
    };

    await storage.saveJson("songPlan", plan.id, plan);

    return res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("Song plan endpoint failed:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate song plan",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Phase 5: Song arrangement from SongPlan
router.post("/arrange", async (req, res) => {
  try {
    const { songPlan, songPlanId, addBreakdown, notes } = req.body || {};

    // Prefer full plan in request; allow minimal fallback if only id provided
    if (!songPlan || !songPlan.sections || !Array.isArray(songPlan.sections)) {
      return res.status(400).json({
        error: "songPlan is required with sections for arrangement",
      });
    }

    const plan: SongPlan = songPlan;

    const result = await arrangeSong(plan, { addBreakdown, notes });

    return res.json({
      success: true,
      songPlanId: songPlanId || plan.id,
      arrangementId: result.id,
      arrangement: result.arrangement,
    });
  } catch (error) {
    console.error("Arrangement endpoint failed:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to arrange song",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export function createAiSongRoutes() {
  return router;
}

