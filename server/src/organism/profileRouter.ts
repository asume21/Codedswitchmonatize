import { Router } from "express";
import { profileService } from "./profileService";

export const profileRouter = Router();

// GET /api/organism/profile/:userId
profileRouter.get("/:userId", async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.params.userId);
    if (!profile) return res.status(404).json({ error: "No profile yet" });
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
