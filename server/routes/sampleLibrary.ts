/**
 * server/routes/sampleLibrary.ts
 * Sample Library routes - serves local audio samples via localSampleLibrary service
 */

import { Router, type Request, type Response } from "express";
import { localSampleLibrary } from "../services/localSampleLibrary";

const router = Router();

/**
 * GET /api/sample-library
 * Returns list of all samples with metadata
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const samples = await localSampleLibrary.getAllSamples();

    // Map to the format the SampleLibrary component expects
    const mapped = samples.map(s => ({
      id: s.id,
      name: s.filename,
      path: s.filename,
      category: s.type,
      subcategory: s.variant,
      url: s.url,
      size: 0,
    }));

    // Group by category for easier UI rendering
    const grouped = mapped.reduce((acc, sample) => {
      if (!acc[sample.category]) {
        acc[sample.category] = [];
      }
      acc[sample.category].push(sample);
      return acc;
    }, {} as Record<string, typeof mapped>);

    return res.json({
      success: true,
      samples: mapped,
      grouped,
      totalCount: mapped.length,
      categories: Object.keys(grouped).sort(),
    });
  } catch (err: any) {
    console.error('Sample library error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to load sample library' });
  }
});

/**
 * GET /api/sample-library/categories
 * Returns list of available instrument categories
 */
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const samples = await localSampleLibrary.getAllSamples();
    const categories = [...new Set(samples.map(s => s.type))].sort();

    return res.json({
      success: true,
      categories,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Failed to load categories' });
  }
});

export function createSampleLibraryRoutes() {
  return router;
}
