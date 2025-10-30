import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

console.log('🔧 Fixing old song URLs...\n');

const sql = postgres(DATABASE_URL);

async function fixOldSongs() {
  try {
    // Get all songs
    const allSongs = await sql`SELECT * FROM songs`;
    
    console.log(`📊 Found ${allSongs.length} songs in database\n`);
    
    let fixedCount = 0;
    let alreadyOkCount = 0;
    let brokenCount = 0;
    
    for (const song of allSongs) {
      console.log(`🔍 Checking: ${song.name}`);
      console.log(`   ID: ${song.id}`);
      console.log(`   Original URL: ${song.original_url}`);
      console.log(`   Accessible URL: ${song.accessible_url}`);
      
      let needsUpdate = false;
      let newAccessibleUrl = song.accessible_url;
      
      // Check if the URL is in the old format or missing
      if (!song.accessible_url || song.accessible_url === song.original_url) {
        // If accessible URL is missing or same as original, it needs fixing
        if (song.original_url.includes('/api/internal/uploads/')) {
          // URL is already in correct format
          newAccessibleUrl = song.original_url;
          needsUpdate = true;
        } else if (song.original_url.startsWith('blob:')) {
          // Blob URLs can't be used - these songs are broken
          console.log(`   ❌ Blob URL detected - this song needs to be re-uploaded`);
          brokenCount++;
          console.log('');
          continue;
        } else {
          // Extract filename from URL and create proper internal URL
          const urlParts = song.original_url.split('/');
          const filename = urlParts[urlParts.length - 1];
          newAccessibleUrl = `/api/internal/uploads/${filename}`;
          needsUpdate = true;
        }
      } else if (!song.accessible_url.startsWith('/api/internal/uploads/') && 
                 !song.accessible_url.startsWith('http')) {
        // Fix relative URLs to be proper internal URLs
        const filename = song.accessible_url.split('/').pop();
        newAccessibleUrl = `/api/internal/uploads/${filename}`;
        needsUpdate = true;
      }
      
      if (needsUpdate && newAccessibleUrl !== song.accessible_url) {
        console.log(`   ✏️  Updating to: ${newAccessibleUrl}`);
        
        await sql`
          UPDATE songs 
          SET accessible_url = ${newAccessibleUrl}
          WHERE id = ${song.id}
        `;
        
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
    console.log(`❌ Broken (need re-upload): ${brokenCount} songs`);
    console.log(`📊 Total: ${allSongs.length} songs`);
    console.log('='.repeat(50));
    
    if (brokenCount > 0) {
      console.log('\n💡 Note: Songs with blob: URLs need to be re-uploaded');
      console.log('   The files no longer exist in browser memory');
    }
    
    if (fixedCount > 0) {
      console.log('\n✅ URLs have been fixed! Try playing the songs again.');
    }
    
  } catch (error) {
    console.error('❌ Error fixing songs:', error);
    throw error;
  } finally {
    await sql.end();
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
