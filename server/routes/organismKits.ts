import { Router } from "express";
import { findOrganismKitSample, getOrganismKitRoot, listOrganismKits, pickBestOrganismKit } from "../services/organismKitLibrary";

const router = Router();

const sampleUrl = (kitId: string, relativePath: string) =>
  `/api/organism/kits/${encodeURIComponent(kitId)}/samples/${relativePath.split("/").map(encodeURIComponent).join("/")}`;

// PUBLIC: these are shared static instrument samples (drum kits + 808 bass),
// not user data — like /api/loops and /api/neumann-bass. They MUST be public:
// the client loads them with a raw fetch / Tone.Sampler media fetch that can't
// attach a Bearer token, so gating them collapses the bass to the synth
// fallback (the documented neumann-bass trap). Whitelisted in requireAuthExcept.
router.get("/kits", (_req, res) => {
  const kits = listOrganismKits().map((kit) => {
    const counts = kit.samples.reduce((acc, sample) => {
      acc[sample.role] = (acc[sample.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      id: kit.id,
      name: kit.name,
      sampleCount: kit.samples.length,
      counts,
      licenseNote: kit.licenseNote,
      samples: kit.samples.map((sample) => ({
        role: sample.role,
        fileName: sample.fileName,
        relativePath: sample.relativePath,
        url: sampleUrl(kit.id, sample.relativePath),
        rootNote: sample.rootNote,
      })),
    };
  });

  const best = pickBestOrganismKit();

  res.json({
    success: true,
    rootConfigured: Boolean(getOrganismKitRoot()),
    kitCount: kits.length,
    bestKitId: best?.id ?? null,
    kits,
  });
});

router.get("/kits/:kitId/samples/*", (req, res) => {
  const kitId = req.params.kitId;
  const relativePath = (req.params as Record<string, string>)[0];
  const sample = findOrganismKitSample(kitId, relativePath);

  if (!sample) {
    return res.status(404).json({ message: "Sample not found" });
  }

  res.set("Cache-Control", "private, max-age=604800");
  res.set("Accept-Ranges", "bytes");
  return res.sendFile(sample.filePath);
});

export function createOrganismKitRoutes() {
  return router;
}
