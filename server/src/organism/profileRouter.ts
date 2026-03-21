import { Router } from "express";
import { profileService } from "./profileService";

export const profileRouter = Router();

// GET /api/organism/profile/:userId
profileRouter.get("/:userId", async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.params.userId);
    // Return empty neutral profile instead of 404 — organism starts fresh
    if (!profile) return res.json({ userId: req.params.userId, grooveProfile: null, history: [] });
    return res.json(profile);
  } catch (err) {
    console.error("[profileRouter] GET error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/organism/profile/:userId/recompute
profileRouter.post("/:userId/recompute", async (req, res) => {
  try {
    const profile = await profileService.recompute(req.params.userId);
    return res.status(200).json(profile);
  } catch (err) {
    console.error("[profileRouter] POST recompute error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
