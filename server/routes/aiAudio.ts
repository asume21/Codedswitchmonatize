import { Router } from "express";
import { backingTrackService } from "../services/backingTrack";

const router = Router();

router.post("/backing-track", async (req, res) => {
  try {
    const { songPlanId, sectionId, prompt, durationSeconds, seed } = req.body || {};

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const duration = typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : 15;

    const result = await backingTrackService.generateBackingTrack({
      prompt,
      durationSeconds: duration,
      seed,
    });

    return res.json({
      success: true,
      audioUrl: result.audioUrl,
      sectionId,
      songPlanId,
      durationSeconds: duration,
      sourcePath: result.sourcePath,
    });
  } catch (error) {
    console.error("Backing track generation failed:", error);
    return res.status(502).json({
      success: false,
      error: "Failed to generate backing track",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export function createAiAudioRoutes() {
  return router;
}
