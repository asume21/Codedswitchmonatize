// Simple Node.js script to test AI APIs on the live website
// Run with: node test-ai-live.js

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5000/api';

// Test credentials (UPDATE THESE with real user credentials)
const TEST_USER = {
  email: 'your-email@example.com',  // <-- UPDATE THIS
  password: 'your-password',        // <-- UPDATE THIS
};

let authToken = '';

async function testLiveAI() {
  console.log('🎵 Testing AI APIs on Live Website');
  console.log('=====================================');

  try {
    // 1. Login to get auth token
    console.log('\n1️⃣ Logging in...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    console.log('✅ Login successful');
    console.log(`📊 Subscription Status: ${loginData.user.subscriptionTier}`);

    // 2. Test Beat Generator
    console.log('\n2️⃣ Testing Beat Generator...');
    const beatResponse = await fetch(`${API_BASE}/beats/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ genre: 'hip-hop', bpm: 120, duration: 8 }),
    });
    
    if (beatResponse.ok) {
      const beatData = await beatResponse.json();
      console.log('✅ Beat Generator works');
      console.log(`🎵 Audio URL: ${beatData.beat?.audioUrl ? 'VALID' : 'MISSING'}`);
      console.log(`🎛️ BPM: ${beatData.beat?.bpm || 'MISSING'}`);
    } else {
      console.error('❌ Beat Generator failed:', await beatResponse.text());
    }

    // 3. Test Melody Composer
    console.log('\n3️⃣ Testing Melody Composer...');
    const melodyResponse = await fetch(`${API_BASE}/melody/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ genre: 'pop', mood: 'uplifting' }),
    });
    
    if (melodyResponse.ok) {
      const melodyData = await melodyResponse.json();
      console.log('✅ Melody Composer works');
      console.log(`🎹 Audio URL: ${melodyData.data?.audioUrl ? 'VALID' : 'MISSING'}`);
    } else {
      console.error('❌ Melody Composer failed:', await melodyResponse.text());
    }

    // 4. Test Lyrics Generator
    console.log('\n4️⃣ Testing Lyrics Generator...');
    const lyricsResponse = await fetch(`${API_BASE}/lyrics/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ theme: 'love', genre: 'pop', mood: 'romantic' }),
    });
    
    if (lyricsResponse.ok) {
      const lyricsData = await lyricsResponse.json();
      console.log('✅ Lyrics Generator works');
      console.log(`📝 Content: ${lyricsData.content || lyricsData.lyrics ? 'VALID' : 'MISSING'}`);
    } else {
      console.error('❌ Lyrics Generator failed:', await lyricsResponse.text());
    }

    // 5. Test Lyrics to Beat
    console.log('\n5️⃣ Testing Lyrics to Beat...');
    const lyricsBeatResponse = await fetch(`${API_BASE}/lyrics/generate-beat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ lyrics: 'I love the way you move', genre: 'hip-hop' }),
    });
    
    if (lyricsBeatResponse.ok) {
      const lyricsBeatData = await lyricsBeatResponse.json();
      console.log('✅ Lyrics to Beat works');
      console.log(`🥁 Pattern: ${lyricsBeatData.pattern ? 'VALID' : 'MISSING'}`);
    } else {
      console.error('❌ Lyrics to Beat failed:', await lyricsBeatResponse.text());
    }

    // 6. Test Lyrics to Music
    console.log('\n6️⃣ Testing Lyrics to Music...');
    const lyricsMusicResponse = await fetch(`${API_BASE}/lyrics/generate-music`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ lyrics: 'test lyrics', style: 'pop' }),
    });
    
    if (lyricsMusicResponse.ok) {
      const lyricsMusicData = await lyricsMusicResponse.json();
      console.log('✅ Lyrics to Music works');
      console.log(`🎵 Audio URL: ${lyricsMusicData.audioUrl ? 'VALID' : 'MISSING'}`);
    } else {
      console.error('❌ Lyrics to Music failed:', await lyricsMusicResponse.text());
    }

    // 7. Test Pack Generator
    console.log('\n7️⃣ Testing Pack Generator...');
    const packResponse = await fetch(`${API_BASE}/music/generate-with-musicgen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt: 'electronic beat', duration: 10 }),
    });
    
    if (packResponse.ok) {
      const packData = await packResponse.json();
      console.log('✅ Pack Generator works');
      console.log(`🎵 Audio URL: ${packData.audioUrl ? 'VALID' : 'MISSING'}`);
    } else {
      console.error('❌ Pack Generator failed:', await packResponse.text());
    }

    // 8. Test Complete Song (may timeout)
    console.log('\n8️⃣ Testing Complete Song (this may take a while)...');
    const completeSongResponse = await fetch(`${API_BASE}/music/generate-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ songDescription: 'happy pop song', includeVocals: true }),
    });
    
    if (completeSongResponse.ok) {
      const songData = await completeSongResponse.json();
      console.log('✅ Complete Song works');
      console.log(`🎵 Audio URL: ${songData.audioUrl ? 'VALID' : 'MISSING'}`);
    } else {
      console.error('❌ Complete Song failed:', await completeSongResponse.text());
    }

    // 9. Test ChatMusician
    console.log('\n9️⃣ Testing ChatMusician...');
    const chatMusicianResponse = await fetch(`${API_BASE}/chatmusician/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt: 'happy melody', style: 'classical' }),
    });
    
    if (chatMusicianResponse.ok) {
      const chatData = await chatMusicianResponse.json();
      console.log('✅ ChatMusician works');
      console.log(`🎹 Melody: ${chatData.melody ? 'VALID' : 'MISSING'}`);
    } else {
      console.error('❌ ChatMusician failed:', await chatMusicianResponse.text());
    }

    // 10. Test Authentication
    console.log('\n🔐 Testing Authentication (no token)...');
    const noAuthResponse = await fetch(`${API_BASE}/beats/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre: 'hip-hop', bpm: 120, duration: 8 }),
    });
    
    if (noAuthResponse.status === 401) {
      console.log('✅ Authentication check passed - returns 401');
    } else {
      console.error('❌ Authentication check failed - should return 401');
    }

    console.log('\n🎉 Live AI Testing Complete!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testLiveAI();
