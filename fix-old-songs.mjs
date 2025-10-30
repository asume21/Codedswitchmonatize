import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { songs } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

console.log('🔧 Fixing old song URLs...\n');

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function fixOldSongs() {
  try {
    // Get all songs
    const allSongs = await db.select().from(songs);
    
    console.log(`📊 Found ${allSongs.length} songs in database\n`);
    
    let fixedCount = 0;
    let alreadyOkCount = 0;
    
    for (const song of allSongs) {
      console.log(`🔍 Checking: ${song.name}`);
      console.log(`   Original URL: ${song.originalUrl}`);
      console.log(`   Accessible URL: ${song.accessibleUrl}`);
      
      let needsUpdate = false;
      let newAccessibleUrl = song.accessibleUrl;
      
      // Check if the URL is in the old format or missing
      if (!song.accessibleUrl || song.accessibleUrl === song.originalUrl) {
        // If accessible URL is missing or same as original, it needs fixing
        if (song.originalUrl.includes('/api/internal/uploads/')) {
          // URL is already in correct format
          newAccessibleUrl = song.originalUrl;
          needsUpdate = true;
        } else if (song.originalUrl.startsWith('blob:')) {
          // Blob URLs can't be used - these songs are broken
          console.log(`   ⚠️  Blob URL detected - this song needs to be re-uploaded`);
          continue;
        } else {
          // Extract filename from URL and create proper internal URL
          const urlParts = song.originalUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          newAccessibleUrl = `/api/internal/uploads/${filename}`;
          needsUpdate = true;
        }
      } else if (!song.accessibleUrl.startsWith('/api/internal/uploads/') && 
                 !song.accessibleUrl.startsWith('http')) {
        // Fix relative URLs to be proper internal URLs
        const filename = song.accessibleUrl.split('/').pop();
        newAccessibleUrl = `/api/internal/uploads/${filename}`;
        needsUpdate = true;
      }
      
      if (needsUpdate && newAccessibleUrl !== song.accessibleUrl) {
        console.log(`   ✏️  Updating to: ${newAccessibleUrl}`);
        
        await db
          .update(songs)
          .set({ accessibleUrl: newAccessibleUrl })
          .where(eq(songs.id, song.id));
        
        fixedCount++;
        console.log(`   ✅ Fixed!`);
      } else {
        console.log(`   ✓ Already OK`);
        alreadyOkCount++;
      }
      
      console.log('');
    }
    
    console.log('='.repeat(50));
    console.log(`✅ Fixed: ${fixedCount} songs`);
    console.log(`✓ Already OK: ${alreadyOkCount} songs`);
    console.log(`📊 Total: ${allSongs.length} songs`);
    console.log('='.repeat(50));
    
    if (fixedCount > 0) {
      console.log('\n💡 Note: Songs with blob: URLs need to be re-uploaded');
      console.log('   The files no longer exist in browser memory');
    }
    
  } catch (error) {
    console.error('❌ Error fixing songs:', error);
    throw error;
  } finally {
    await client.end();
  }
}

fixOldSongs()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
