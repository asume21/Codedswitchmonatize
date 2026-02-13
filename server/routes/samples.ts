import { Router, Request, Response } from "express";
import { localSampleLibrary } from "../services/localSampleLibrary";
import { createReadStream, existsSync } from "fs";
import { validateFilename } from "../utils/security";

const router = Router();

/**
 * Sample Library Routes
 * Provides access to local audio samples
 */

// Get all samples
router.get("/", async (_req: Request, res: Response) => {
  try {
    const samples = await localSampleLibrary.getAllSamples();
    res.json({ success: true, samples });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get samples by type
router.get("/type/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const samples = await localSampleLibrary.getSamplesByType(type as any);
    res.json({ success: true, samples });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Search samples
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
    }
    const samples = await localSampleLibrary.searchSamples(query);
    res.json({ success: true, samples });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get library statistics
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await localSampleLibrary.getStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate a sample pack
router.post("/generate-pack", async (req: Request, res: Response) => {
  try {
    const { genre, bpm, includeLoops, sampleCount } = req.body;
    const pack = await localSampleLibrary.generatePack({
      genre,
      bpm,
      includeLoops,
      sampleCount
    });
    res.json({ success: true, pack });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stream a sample file
router.get("/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    // Validate filename (security - prevent path traversal)
    const safeFilename = validateFilename(filename);
    if (!safeFilename || !safeFilename.endsWith('.wav')) {
      return res.status(400).json({ success: false, message: "Invalid filename" });
    }
    
    const filePath = localSampleLibrary.getSamplePath(filename);
    
    if (!existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Sample not found" });
    }
    
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export function createSampleRoutes() {
  return router;
}
