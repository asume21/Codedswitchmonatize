import { readFile, rename, stat } from 'fs/promises';
import { join } from 'path';
import { readdirSync } from 'fs';
import { db } from '../db';
import { songs } from '@shared/schema';
import { eq } from 'drizzle-orm';

const OBJECTS_DIR = process.env.LOCAL_OBJECTS_DIR || join(process.cwd(), 'objects');
const SONGS_DIR = join(OBJECTS_DIR, 'songs');

// Magic bytes for common audio formats
const MAGIC_BYTES: Record<string, { bytes: number[]; extension: string }> = {
  mp3: { bytes: [0xFF, 0xFB], extension: 'mp3' }, // MP3 (MPEG)
  mp3_id3: { bytes: [0x49, 0x44, 0x33], extension: 'mp3' }, // MP3 with ID3v2
  m4a: { bytes: [0x00, 0x00, 0x00], extension: 'm4a' }, // M4A/MP4 (ftyp at offset 4)
  wav: { bytes: [0x52, 0x49, 0x46, 0x46], extension: 'wav' }, // WAV (RIFF)
  ogg: { bytes: [0x4F, 0x67, 0x67, 0x53], extension: 'ogg' }, // OGG (OggS)
  flac: { bytes: [0x66, 0x4C, 0x61, 0x43], extension: 'flac' }, // FLAC
};

function detectAudioFormat(buffer: Buffer): string | null {
  // Check MP3 with ID3v2
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return 'mp3';
  }
  
  // Check MP3 (MPEG frame sync)
  if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    return 'mp3';
  }
  
  // Check M4A/MP4
  if (buffer.length >= 12) {
    const ftypOffset = buffer.toString('ascii', 4, 8);
    if (ftypOffset === 'ftyp' || buffer.toString('ascii', 4, 8).includes('M4A')) {
      return 'm4a';
    }
  }
  
  // Check WAV (RIFF)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'wav';
  }
  
  // Check OGG
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return 'ogg';
  }
  
  // Check FLAC
  if (buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) {
    return 'flac';
  }
  
  return null;
}

async function migrateSongs() {
  console.log('🔧 Starting song extension migration...');
  console.log(`📁 Scanning directory: ${SONGS_DIR}`);
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  try {
    const files = readdirSync(SONGS_DIR);
    console.log(`📊 Found ${files.length} files`);
    
    for (const filename of files) {
      const filePath = join(SONGS_DIR, filename);
      
      // Skip if file already has an extension
      if (filename.includes('.')) {
        console.log(`⏭️  Skipping ${filename} (already has extension)`);
        skippedCount++;
        continue;
      }
      
      try {
        // Read first 12 bytes to detect format
        const buffer = await readFile(filePath);
        const format = detectAudioFormat(buffer);
        
        if (!format) {
          console.log(`❌ Could not detect format for ${filename}`);
          errorCount++;
          continue;
        }
        
        // New filename with extension
        const newFilename = `${filename}.${format}`;
        const newFilePath = join(SONGS_DIR, newFilename);
        
        console.log(`🔄 Migrating ${filename} → ${newFilename}`);
        
        // Rename the file
        await rename(filePath, newFilePath);
        
        // Update database - find song with old URL and update it
        const oldUrl = `songs/${filename}`;
        const newUrl = `songs/${newFilename}`;
        
        await db
          .update(songs)
          .set({ songURL: newUrl })
          .where(eq(songs.songURL, oldUrl))
          .execute();
        
        console.log(`✅ Migrated ${filename} → ${newFilename} (format: ${format})`);
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Error migrating ${filename}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateSongs()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
