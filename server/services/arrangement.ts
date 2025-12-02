import { randomUUID } from "crypto";
import type { ArrangementTimeline, SongPlan, SongSection } from "@shared/types/aiMusic";
import { callAI } from "./aiGateway";
import { LocalStorageService } from "./localStorageService";

const storage = new LocalStorageService();

const arrangementSchema = {
  type: "object",
  required: ["timeline"],
  properties: {
    timeline: {
      type: "array",
      items: {
        type: "object",
        required: ["sectionId", "startBar"],
        properties: {
          sectionId: { type: "string" },
          startBar: { type: "number" },
        },
        additionalProperties: false,
      },
      minItems: 1,
    },
    automationIdeas: {
      type: "array",
      items: { type: "string" },
    },
  },
  additionalProperties: false,
};

function buildDefaultTimeline(sections: SongSection[]): ArrangementTimeline {
  const timeline: ArrangementTimeline["timeline"] = [];
  let cursor = 0;
  for (const section of sections) {
    timeline.push({ sectionId: section.id, startBar: cursor });
    cursor += section.bars;
  }
  return { timeline };
}

export async function arrangeSong(plan: SongPlan, options?: { addBreakdown?: boolean; notes?: string }) {
  const system = `You are a professional producer and arranger. Create a bar-accurate arrangement timeline from a SongPlan. Return ONLY valid JSON matching the schema.`;

  const userLines = [
    `Song meta: ${plan.genre} ${plan.subGenre ? `(${plan.subGenre})` : ""}, mood ${plan.mood}, key ${plan.key}, ${plan.bpm} BPM, ${plan.timeSignature}.`,
    `Sections (id:type:bars): ${plan.sections.map((s) => `${s.id}:${s.type}:${s.bars}`).join(", ")}.`,
    options?.addBreakdown ? `Include an optional breakdown/re-intro if musically appropriate.` : null,
    options?.notes ? `Additional notes: ${options.notes}` : null,
    `Rules:`,
    `- startBar must be integer bars, sequential, non-overlapping.`,
    `- Use only sectionIds from the provided plan; you may repeat sections if musically sensible.`,
    `- Keep timeline length close to planned duration; avoid adding new unknown sections.`,
  ]
    .filter(Boolean)
    .join(" ");

  let aiResult: ArrangementTimeline | undefined;

  try {
    const response = await callAI<ArrangementTimeline>({
      system,
      user: userLines,
      temperature: 0.35,
      responseFormat: "json",
      jsonSchema: arrangementSchema,
    });
    aiResult = response.content;
  } catch (error) {
    console.error("Arrangement AI failed, falling back to deterministic timeline:", error);
  }

  // Fallback / normalization
  const normalized: ArrangementTimeline = (() => {
    if (!aiResult || !Array.isArray(aiResult.timeline) || aiResult.timeline.length === 0) {
      return buildDefaultTimeline(plan.sections);
    }

    const seen = new Set<string>();
    const timeline: ArrangementTimeline["timeline"] = [];
    for (const entry of aiResult.timeline) {
      if (!entry || typeof entry.sectionId !== "string" || typeof entry.startBar !== "number") continue;
      // Ensure the section exists in the plan
      const hasSection = plan.sections.find((s) => s.id === entry.sectionId);
      if (!hasSection) continue;
      // Avoid duplicates on same startBar/section combo
      const key = `${entry.sectionId}-${entry.startBar}`;
      if (seen.has(key)) continue;
      seen.add(key);
      timeline.push({ sectionId: entry.sectionId, startBar: Math.max(0, Math.round(entry.startBar)) });
    }

    if (timeline.length === 0) {
      return buildDefaultTimeline(plan.sections);
    }

    // Sort by startBar to guarantee monotonic order
    timeline.sort((a, b) => a.startBar - b.startBar);
    return { timeline, automationIdeas: aiResult.automationIdeas || undefined };
  })();

  const id = randomUUID();
  await storage.saveJson("arrangements", id, {
    id,
    songPlanId: plan.id,
    arrangement: normalized,
    createdAt: new Date().toISOString(),
  });

  return { id, arrangement: normalized };
}
