/**
 * server/routes/sampleLibrary.ts
 * Sample Library routes - scan and serve user sound files
 */

import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth";

const router = Router();

// User sample library path
const SAMPLE_LIBRARY_PATH = process.env.SAMPLE_LIBRARY_PATH || (process.env.NODE_ENV === 'production' ? '' : path.resolve("D:\\DATA SET\\good-sounds\\sound_files"));

interface SampleFile {
  id: string;
  name: string;
  path: string;
  category: string;
  subcategory: string;
  url: string;
  size: number;
}

/**
 * Scan sample library directory and return indexed files
 */
function scanSampleLibrary(): SampleFile[] {
  const samples: SampleFile[] = [];

  if (!SAMPLE_LIBRARY_PATH) {
    console.warn('Sample library path not configured');
    return samples;
  }
  
  if (!fs.existsSync(SAMPLE_LIBRARY_PATH)) {
    console.warn(`Sample library path does not exist: ${SAMPLE_LIBRARY_PATH}`);
    return samples;
  }

  try {
    const categories = fs.readdirSync(SAMPLE_LIBRARY_PATH, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory());

    for (const categoryDir of categories) {
      const categoryPath = path.join(SAMPLE_LIBRARY_PATH, categoryDir.name);
      
      // Extract instrument from category name (e.g., "cello_margarita_attack" -> "cello")
      const parts = categoryDir.name.split('_');
      const instrument = parts[0] || 'unknown';
      const subcategory = parts.slice(1).join('_') || 'default';

      try {
        const files = fs.readdirSync(categoryPath, { withFileTypes: true })
          .filter(dirent => dirent.isFile() && /\.(wav|mp3|ogg|flac|aiff)$/i.test(dirent.name));

        for (const file of files) {
          const filePath = path.join(categoryPath, file.name);
          const stats = fs.statSync(filePath);
          const relativePath = path.relative(SAMPLE_LIBRARY_PATH, filePath).replace(/\\/g, '/');
          
          samples.push({
            id: `${categoryDir.name}/${file.name}`,
            name: file.name,
            path: relativePath,
            category: instrument,
            subcategory,
            url: `/api/samples/${encodeURIComponent(relativePath)}`,
            size: stats.size,
          });
        }
      } catch (err) {
        console.warn(`Failed to scan category ${categoryDir.name}:`, err);
      }
    }
  } catch (err) {
    console.error('Failed to scan sample library:', err);
  }

  return samples;
}

/**
 * GET /api/sample-library
 * Returns list of all samples with metadata
 */
router.get("/", (req: Request, res: Response) => {
  try {
    const samples = scanSampleLibrary();
    
    // Group by category for easier UI rendering
    const grouped = samples.reduce((acc, sample) => {
      if (!acc[sample.category]) {
        acc[sample.category] = [];
      }
      acc[sample.category].push(sample);
      return acc;
    }, {} as Record<string, SampleFile[]>);

    return res.json({
      success: true,
      samples,
      grouped,
      totalCount: samples.length,
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
router.get("/categories", (req: Request, res: Response) => {
  try {
    const samples = scanSampleLibrary();
    const categories = [...new Set(samples.map(s => s.category))].sort();
    
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
