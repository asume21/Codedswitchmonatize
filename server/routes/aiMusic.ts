import { Router } from "express";
import { randomUUID } from "crypto";
import { callAI } from "../services/aiGateway";
import { LocalStorageService } from "../services/localStorageService";
import type { MelodyTrack, DrumGrid, BassTrack, AiNote } from "@shared/types/aiMusic";

const router = Router();
const storage = new LocalStorageService();
const AI_TIMEOUT_MS = 10000; // Hard cap AI latency so routes never hang

// Shared helper to coerce AiNote arrays
function normalizeNotes(raw: any): AiNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => {
      const time = typeof n.time === "number" ? n.time : 0;
      const duration = typeof n.duration === "number" && n.duration > 0 ? n.duration : 1;
      const pitch = typeof n.pitch === "string" ? n.pitch : "C4";
      const velocity = typeof n.velocity === "number" ? Math.min(1, Math.max(0, n.velocity)) : 0.8;
      return { time, duration, pitch, velocity } as AiNote;
    })
    .filter((n) => n.duration > 0);
}

// Phase 3: Melody generation based on SongPlan section
router.post("/melody", async (req, res) => {
  try {
    const { songPlanId, sectionId, key, bpm, lengthBars, density, contour } = req.body || {};

    if (!songPlanId || !sectionId) {
      return res.status(400).json({
        success: false,
        error: "songPlanId and sectionId are required",
      });
    }

    const promptLines = [
      "Generate a melodic line for a specific section of a song plan.",
      "Return ONLY valid JSON with a 'notes' array (no prose).",
      "Each note must have: time (beats), duration (beats), pitch (e.g. 'C4'), velocity (0-1).",
      "",
      `Section: ${sectionId}`,
      key ? `Key: ${key}` : null,
      bpm ? `BPM: ${bpm}` : null,
      lengthBars ? `Length: ${lengthBars} bars` : null,
      density ? `Density: ${density}` : null,
      contour ? `Contour: ${contour}` : null,
      "",
      "Create a performance-ready, singable or playable melody that fits modern production.",
    ].filter(Boolean);

    let raw: any = {};

    try {
      const response = await callAI<{ notes: any[] }>({
        system:
          "You are a professional topline writer and melody composer. You design melodic phrases for hooks and verses.",
        user: promptLines.join("\n"),
        temperature: 0.7,
        responseFormat: "json",
      });
      raw = response.content || {};
    } catch (error) {
      console.error("AI melody generation failed; using fallback:", error);
    }

    const notes = normalizeNotes(raw.notes);

    const track: MelodyTrack = {
      sectionId,
      trackType: "melody",
      notes: notes.length
        ? notes
        : [
            { time: 0, duration: 1, pitch: key ? key.split(" ")[0] + "4" : "C4", velocity: 0.9 },
            { time: 1, duration: 1, pitch: "D#4", velocity: 0.9 },
            { time: 2, duration: 1, pitch: "F4", velocity: 0.9 },
            { time: 3, duration: 1, pitch: key ? key.split(" ")[0] + "4" : "C4", velocity: 0.9 },
          ],
    };

    const id = randomUUID();
    await storage.saveJson("midi-melody", id, { songPlanId, sectionId, track });

    return res.json({
      success: true,
      id,
      data: track,
    });
  } catch (error) {
    console.error("Melody pattern endpoint failed:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate melody pattern",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Phase 3: Drum grid generation per section
router.post("/drums", async (req, res) => {
  try {
    const { songPlanId, sectionId, bpm, bars, style, gridResolution } = req.body || {};

    if (!sectionId) {
      return res.status(400).json({
        success: false,
        error: "sectionId is required",
      });
    }

    const resolution: "1/16" | "1/8" = gridResolution === "1/8" ? "1/8" : "1/16";
    const totalSteps = (resolution === "1/16" ? 16 : 8) * (bars && bars > 0 ? bars : 4);

    const promptLines = [
      "Generate a drum pattern grid for a DAW step sequencer.",
      "Return ONLY valid JSON with arrays for kick, snare, hihat (0/1 per step).",
      "",
      `Section: ${sectionId}`,
      bpm ? `BPM: ${bpm}` : null,
      `Bars: ${bars || 4}`,
      `Resolution: ${resolution} notes`,
      style ? `Style: ${style}` : null,
      "",
      "Focus on genre-appropriate groove, with clear backbeat and hat pattern.",
    ].filter(Boolean);

    let raw: any = {};

    try {
      // Protect against slow/blocked AI providers with a hard timeout
      const aiPromise = callAI<{ kick: number[]; snare: number[]; hihat: number[] }>({
        system:
          "You are a professional drum programmer. You output step-sequencer patterns as arrays of 0/1 values.",
        user: promptLines.join("\n"),
        temperature: 0.6,
        responseFormat: "json",
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("AI drum grid timeout")), AI_TIMEOUT_MS);
      });

      const response = await Promise.race([aiPromise, timeoutPromise]);
      raw = (response as any).content || {};
    } catch (error) {
      console.error("AI drum grid generation failed or timed out; using fallback:", error);
      raw = {};
    }

    function normalizeRow(row: any): number[] {
      if (!Array.isArray(row)) return Array(totalSteps).fill(0);
      const trimmed = row
        .map((v) => (v ? 1 : 0))
        .slice(0, totalSteps);
      if (trimmed.length < totalSteps) {
        return [...trimmed, ...Array(totalSteps - trimmed.length).fill(0)];
      }
      return trimmed;
    }

    let kick = normalizeRow(raw.kick);
    let snare = normalizeRow(raw.snare);
    let hihat = normalizeRow(raw.hihat);

    // If AI returned nothing useful, fall back to a simple but musical pattern
    const hasAnyHits = [...kick, ...snare, ...hihat].some((v) => v === 1);
    if (!hasAnyHits) {
      // Four-on-the-floor kick, backbeat snare, steady hats
      kick = Array.from({ length: totalSteps }, (_, i) => (i % 4 === 0 ? 1 : 0));
      snare = Array.from({ length: totalSteps }, (_, i) => (i % 8 === 4 ? 1 : 0));
      hihat = Array.from({ length: totalSteps }, () => 1);
    }

    const grid: DrumGrid = {
      sectionId,
      trackType: "drums",
      grid: { kick, snare, hihat },
      resolution,
      bars: bars && bars > 0 ? bars : 4,
    };

    const id = randomUUID();
    await storage.saveJson("midi-drums", id, { songPlanId, sectionId, grid });

    return res.json({
      success: true,
      id,
      data: grid,
    });
  } catch (error) {
    console.error("Drum pattern endpoint failed:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate drum pattern",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Phase 3: Bassline generation per section
router.post("/bass", async (req, res) => {
  try {
    const { songPlanId, sectionId, key, bpm, bars, chordProgression } = req.body || {};

    if (!songPlanId || !sectionId || !key) {
      return res.status(400).json({
        success: false,
        error: "songPlanId, sectionId, and key are required",
      });
    }

    const promptLines = [
      "Generate a bassline pattern that fits the key and chord progression.",
      "Return ONLY valid JSON with a 'notes' array (no prose).",
      "Use bass register pitches (e.g. C2, E2, G2).",
      "",
      `Section: ${sectionId}`,
      `Key: ${key}`,
      bpm ? `BPM: ${bpm}` : null,
      bars ? `Bars: ${bars}` : null,
      chordProgression ? `Chord progression: ${JSON.stringify(chordProgression)}` : null,
      "",
      "Make it groove and support the harmony with genre-appropriate rhythm.",
    ].filter(Boolean);

    let raw: any = {};

    try {
      const response = await callAI<{ notes: any[] }>({
        system:
          "You are a professional bass player. You write basslines that support the groove and harmony.",
        user: promptLines.join("\n"),
        temperature: 0.7,
        responseFormat: "json",
      });
      raw = response.content || {};
    } catch (error) {
      console.error("AI bassline generation failed; using fallback:", error);
    }

    const notes = normalizeNotes(raw.notes);

    const track: BassTrack = {
      sectionId,
      trackType: "bass",
      notes: notes.length
        ? notes
        : [
            { time: 0, duration: 1, pitch: key.split(" ")[0] + "2", velocity: 0.9 },
            { time: 1, duration: 1, pitch: key.split(" ")[0] + "2", velocity: 0.85 },
            { time: 2, duration: 1, pitch: key.split(" ")[0] + "1", velocity: 0.9 },
            { time: 3, duration: 1, pitch: key.split(" ")[0] + "2", velocity: 0.88 },
          ],
    };

    const id = randomUUID();
    await storage.saveJson("midi-bass", id, { songPlanId, sectionId, track });

    return res.json({
      success: true,
      id,
      data: track,
    });
  } catch (error) {
    console.error("Bass pattern endpoint failed:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate bass pattern",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export function createAiMusicRoutes() {
  return router;
}
