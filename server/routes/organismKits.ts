import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { findOrganismKitSample, getOrganismKitRoot, listOrganismKits, pickBestOrganismKit } from "../services/organismKitLibrary";

const router = Router();

const sampleUrl = (kitId: string, relativePath: string) =>
  `/api/organism/kits/${encodeURIComponent(kitId)}/samples/${relativePath.split("/").map(encodeURIComponent).join("/")}`;

router.get("/kits", requireAuth(), (_req, res) => {
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

router.get("/kits/:kitId/samples/*", requireAuth(), (req, res) => {
  const kitId = req.params.kitId;
  const relativePath = req.params[0];
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
