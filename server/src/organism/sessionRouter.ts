import { Router } from "express";
import { sessionService } from "./sessionService";
import { makeAICall } from "../../services/grok";
import { localAI } from "../../services/localAI";

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
// Uses Ollama (local/Railway) first, falls back to Grok-3 cloud.
sessionRouter.post("/generate-pattern", async (req, res) => {
  const { section = "verse", physics = {}, bpm = 90, lyrics = "" } = req.body;

  const mode     = physics.mode     ?? "boom_bap";
  const bounce   = ((physics.bounce   ?? 0.5) * 100).toFixed(0);
  const swing    = ((physics.swing    ?? 0.5) * 100).toFixed(0);
  const presence = ((physics.presence ?? 0.3) * 100).toFixed(0);
  const density  = ((physics.density  ?? 0.5) * 100).toFixed(0);

  // Tailor the pattern feel to the arrangement section
  const sectionHint: Record<string, string> = {
    intro:     "sparse — just kick and hat, leave room for the voice to enter",
    verse:     "tight and pocketed — support the rapper without fighting the vocals",
    verse2:    "same as verse but add one extra syncopated kick for energy lift",
    build:     "escalating — add hat density and a snare roll on beats 14–15",
    drop:      "maximum impact — punchy kick, crisp snare, driving hats",
    drop2:     "maximum impact with variation — change the kick syncopation from drop",
    breakdown: "stripped — just kick on 0, snare on 8, half-time feel",
    outro:     "winding down — fewer hats, relaxed kick",
  };
  const feel = sectionHint[section] ?? "balanced";

  const lyricsLine = lyrics.trim()
    ? `\nLast lyrical phrase: "${lyrics.slice(-120).trim()}" — match the energy.`
    : "";

  const systemPrompt = "You are a hip-hop beat programmer. Always respond with valid JSON only, no markdown, no explanation.";
  const userPrompt = `Generate a fresh 16-step drum pattern for the "${section}" section.
Feel: ${feel}${lyricsLine}

Physics: mode=${mode}, bounce=${bounce}%, swing=${swing}%, presence=${presence}%, density=${density}%, bpm=${bpm}

Return ONLY this JSON shape:
{"kicks": [...], "snares": [...], "hats": [...], "percs": [...]}

Step indices 0–15 (16th-note grid, one bar).
- kicks: 1–4 hits. Beat 0 almost always. Higher bounce = more syncopation.
- snares: 2 hits on beats 4 and 12 (backbeat). Drop sections can add beat 14–15.
- hats: 4–14 hits. Higher density = denser. Higher swing = favour odd steps.
- percs: 0–3 rim/shaker accents.`;

  let raw: string | null = null;

  // Try local Ollama first (free, fast on Railway), fall back to Grok-3 cloud
  try {
    raw = await localAI.generate(userPrompt, { format: "json", temperature: 0.85 });
    console.log("[organism:generate-pattern] Used local AI (Ollama)");
  } catch {
    // Ollama not running in this environment — use cloud
    try {
      const response = await makeAICall(
        [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt  },
        ],
        { response_format: { type: "json_object" }, temperature: 0.85, max_tokens: 200 }
      );
      raw = response.choices?.[0]?.message?.content ?? "{}";
      console.log("[organism:generate-pattern] Used cloud AI (Grok-3 fallback)");
    } catch (cloudErr) {
      console.error("[organism:generate-pattern] Both AI providers failed:", cloudErr);
      return res.status(500).json({ error: "Pattern generation failed" });
    }
  }

  try {
    const parsed = JSON.parse(raw ?? "{}");

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
  } catch (parseErr) {
    console.error("[organism:generate-pattern] Failed to parse AI JSON:", parseErr, "\nRaw:", raw?.slice(0, 200));
    return res.status(500).json({ error: "Pattern generation failed — invalid JSON" });
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
