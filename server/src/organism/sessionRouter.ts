import { Router } from "express";
import { sessionService } from "./sessionService";
import { makeAICall } from "../../services/grok";

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

// POST /api/organism/generate-pattern
// Takes the current physics state and arrangement section, returns a novel
// AI-generated drum pattern as DrumHit[] so the organism expands beyond its
// hardcoded pattern library.
sessionRouter.post("/generate-pattern", async (req, res) => {
  const { section = "verse", physics = {}, bpm = 90 } = req.body;

  const mode     = physics.mode     ?? "boom_bap";
  const bounce   = ((physics.bounce   ?? 0.5) * 100).toFixed(0);
  const swing    = ((physics.swing    ?? 0.5) * 100).toFixed(0);
  const presence = ((physics.presence ?? 0.3) * 100).toFixed(0);
  const density  = ((physics.density  ?? 0.5) * 100).toFixed(0);

  const prompt = `You are a hip-hop drum programmer. Generate a fresh 16-step drum pattern for the "${section}" section.

Physics context: mode=${mode}, bounce=${bounce}%, swing=${swing}%, presence=${presence}%, density=${density}%, bpm=${bpm}

Return ONLY a JSON object. Each key is an array of active step indices (0–15, one bar of 16th notes):
{"kicks": [...], "snares": [...], "hats": [...], "percs": [...]}

Rules:
- kicks: 1–4 hits. Beat 0 always, beat 8 common. Higher bounce = more syncopation.
- snares: exactly 2 hits on beats 4 and 12 (backbeat). Fill allowed on beat 14–15 for drop sections.
- hats: 4–14 hits. Higher density = more 16th-note hats. Higher swing = bias off-beats (1,3,5,7...).
- percs: 0–3 hits for rim/shaker accents.
Vary from standard patterns — be creative but musical.`;

  try {
    const response = await makeAICall(
      [
        { role: "system", content: "You are a hip-hop beat programmer. Always respond with valid JSON only, no markdown." },
        { role: "user", content: prompt },
      ],
      { response_format: { type: "json_object" }, temperature: 0.85, max_tokens: 200 }
    );

    const raw = response.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    // Convert step indices (0–15) to DrumHit time format "bar:beat:sub"
    // The organism plays 4-bar loops; we populate bar 0 and let it loop.
    function stepsToHits(
      steps: unknown,
      instrument: "kick" | "snare" | "hat" | "perc"
    ) {
      if (!Array.isArray(steps)) return [];
      return steps
        .filter((s): s is number => typeof s === "number" && s >= 0 && s < 16)
        .map((step) => ({
          instrument,
          time: `0:${Math.floor(step / 4)}:${step % 4}`,
          velocity: 0.65 + Math.random() * 0.30,
        }));
    }

    const hits = [
      ...stepsToHits(parsed.kicks,  "kick"),
      ...stepsToHits(parsed.snares, "snare"),
      ...stepsToHits(parsed.hats,   "hat"),
      ...stepsToHits(parsed.percs,  "perc"),
    ];

    return res.json({ hits });
  } catch (err) {
    console.error("[organism:generate-pattern] AI call failed:", err);
    return res.status(500).json({ error: "Pattern generation failed" });
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
