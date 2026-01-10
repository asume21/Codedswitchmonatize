import fs from 'fs';
import path from 'path';

/**
 * Sample Import Script
 * Copies samples from D:\Wav into the project structure with proper naming
 */

const SOURCE_DIR = 'D:\\Wav';
const TARGET_DIR = path.join(process.cwd(), 'audio', 'samples');

interface SampleInfo {
  originalPath: string;
  targetPath: string;
  type: 'kick' | 'snare' | 'hihat' | 'loop' | 'percussion' | 'other';
  variant: string;
  bpm?: number;
}

function detectSampleType(filename: string): { type: SampleInfo['type']; variant: string; bpm?: number } {
  const lower = filename.toLowerCase();
  
  // Extract BPM if present
  const bpmMatch = lower.match(/(\d+)\s*bpm/);
  const bpm = bpmMatch ? parseInt(bpmMatch[1]) : undefined;
  
  // Detect type and variant
  if (lower.includes('kick') || lower.includes('bd')) {
    const variant = filename.replace(/kick\s*-?\s*/i, '').replace(/\.wav$/i, '').trim().toLowerCase().replace(/\s+/g, '_');
    return { type: 'kick', variant: variant || 'default', bpm };
  }
  
  if (lower.includes('snare') || lower.includes('sd')) {
    const variant = filename.replace(/snare\s*-?\s*/i, '').replace(/\.wav$/i, '').trim().toLowerCase().replace(/\s+/g, '_');
    return { type: 'snare', variant: variant || 'default', bpm };
  }
  
  if (lower.includes('hat') || lower.includes('hh')) {
    const variant = filename.replace(/hats?\s*-?\s*/i, '').replace(/\.wav$/i, '').trim().toLowerCase().replace(/\s+/g, '_');
    return { type: 'hihat', variant: variant || 'default', bpm };
  }
  
  if (lower.includes('loop')) {
    const variant = filename.replace(/loop\s*-?\s*/i, '').replace(/\.wav$/i, '').trim().toLowerCase().replace(/\s+/g, '_');
    return { type: 'loop', variant: variant || 'default', bpm };
  }
  
  if (lower.includes('perc') || lower.includes('shaker') || lower.includes('tambourine') || lower.includes('cowbell')) {
    const variant = filename.replace(/\.wav$/i, '').trim().toLowerCase().replace(/\s+/g, '_');
    return { type: 'percussion', variant, bpm };
  }
  
  return { type: 'other', variant: filename.replace(/\.wav$/i, '').trim().toLowerCase().replace(/\s+/g, '_'), bpm };
}

function scanDirectory(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...scanDirectory(fullPath));
      } else if (item.toLowerCase().endsWith('.wav')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.warn(`⚠️ Could not read directory ${dir}:`, err);
  }
  
  return files;
}

function importSamples() {
  console.log('🎵 CodedSwitch Sample Importer\n');
  
  // Check source directory
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }
  
  // Create target directory
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log(`✅ Created target directory: ${TARGET_DIR}\n`);
  }
  
  // Scan for WAV files
  console.log(`📂 Scanning ${SOURCE_DIR}...`);
  const wavFiles = scanDirectory(SOURCE_DIR);
  console.log(`✅ Found ${wavFiles.length} WAV files\n`);
  
  if (wavFiles.length === 0) {
    console.log('⚠️ No WAV files found to import');
    return;
  }
  
  // Process each file
  const samples: SampleInfo[] = [];
  const stats = {
    kick: 0,
    snare: 0,
    hihat: 0,
    loop: 0,
    percussion: 0,
    other: 0,
    skipped: 0
  };
  
  for (const filePath of wavFiles) {
    const filename = path.basename(filePath);
    const { type, variant, bpm } = detectSampleType(filename);
    
    // Generate target filename
    const targetFilename = `${type}_${variant}.wav`;
    const targetPath = path.join(TARGET_DIR, targetFilename);
    
    // Check if already exists
    if (fs.existsSync(targetPath)) {
      console.log(`⏭️  Skipping (exists): ${targetFilename}`);
      stats.skipped++;
      continue;
    }
    
    // Copy file
    try {
      fs.copyFileSync(filePath, targetPath);
      samples.push({ originalPath: filePath, targetPath, type, variant, bpm });
      stats[type]++;
      console.log(`✅ Imported: ${targetFilename}${bpm ? ` (${bpm} BPM)` : ''}`);
    } catch (err) {
      console.error(`❌ Failed to copy ${filename}:`, err);
    }
  }
  
  // Generate index file
  const indexPath = path.join(TARGET_DIR, 'index.json');
  const index = {
    generated: new Date().toISOString(),
    totalSamples: samples.length,
    samples: samples.map(s => ({
      filename: path.basename(s.targetPath),
      type: s.type,
      variant: s.variant,
      bpm: s.bpm,
      path: path.relative(process.cwd(), s.targetPath)
    }))
  };
  
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  
  // Print summary
  console.log('\n📊 Import Summary:');
  console.log(`   Kicks: ${stats.kick}`);
  console.log(`   Snares: ${stats.snare}`);
  console.log(`   Hi-hats: ${stats.hihat}`);
  console.log(`   Loops: ${stats.loop}`);
  console.log(`   Percussion: ${stats.percussion}`);
  console.log(`   Other: ${stats.other}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Total: ${samples.length} samples imported`);
  console.log(`\n✅ Index created: ${indexPath}`);
}

// Run import
importSamples();
