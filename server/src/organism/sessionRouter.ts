import { Router } from "express";
import { sessionService } from "./sessionService";

export const sessionRouter = Router();

// POST /api/organism/sessions
sessionRouter.post("/", async (req, res) => {
  try {
    const dna = req.body;
    if (!dna.sessionId || !dna.userId) {
      return res.status(400).json({ error: "Missing sessionId or userId" });
    }
    const saved = await sessionService.save(dna);
    return res.status(201).json({ id: saved.id, sessionId: saved.sessionId });
  } catch (err) {
    console.error("[sessionRouter] POST error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/organism/sessions/:userId
sessionRouter.get("/:userId", async (req, res) => {
  try {
    const sessions = await sessionService.listByUser(req.params.userId);
    return res.json(sessions);
  } catch (err) {
    console.error("[sessionRouter] GET error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/organism/sessions/:userId/:sessionId
sessionRouter.get("/:userId/:sessionId", async (req, res) => {
  try {
    const dna = await sessionService.getBySessionId(
      req.params.userId,
      req.params.sessionId
    );
    if (!dna) return res.status(404).json({ error: "Session not found" });
    return res.json(dna);
  } catch (err) {
    console.error("[sessionRouter] GET single error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
