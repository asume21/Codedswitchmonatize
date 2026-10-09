/**
 * Rebuild audio/samples/index.json from what is actually on disk.
 *
 * Drops entries whose file is missing (or macOS AppleDouble `._` junk) and
 * re-files "other" samples by unambiguous filename words (see
 * server/services/sampleClassify). server/services/__tests__/sampleIndex.test.ts
 * fails CI if the index and the folder disagree again.
 *
 * Usage: npx tsx scripts/rebuildSampleIndex.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { classifySampleFilename } from '../server/services/sampleClassify';

const dir = path.join(process.cwd(), 'audio', 'samples');
const file = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(file, 'utf8')) as {
  generated?: string;
  totalSamples: number;
  samples: Array<{ filename: string; type: string; [k: string]: unknown }>;
};

const count = (a: Array<{ type: string }>) =>
  a.reduce<Record<string, number>>((m, s) => ((m[s.type] = (m[s.type] || 0) + 1), m), {});

const before = count(idx.samples);
const kept = idx.samples
  .filter((s) => !s.filename.includes('._') && fs.existsSync(path.join(dir, s.filename)))
  .map((s) => ({ ...s, type: classifySampleFilename(s.filename, s.type) }));

fs.writeFileSync(
  file,
  JSON.stringify({ ...idx, generated: new Date().toISOString(), totalSamples: kept.length, samples: kept }, null, 2) + '\n',
);
console.log(`entries ${idx.samples.length} → ${kept.length}`);
console.log('before', JSON.stringify(before));
console.log('after ', JSON.stringify(count(kept)));
