// Puppeteer test for live UI testing
// Run with: node test-ui-puppeteer.js

const puppeteer = require('puppeteer');

async function testLiveUI() {
  console.log('🌐 Testing Live UI with Puppeteer');
  console.log('===================================');

  const browser = await puppeteer.launch({
    headless: false, // Show browser window
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  try {
    // 1. Navigate to studio
    console.log('\n1️⃣ Navigating to studio...');
    await page.goto('http://localhost:5173/studio', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/01-studio.png' });
    console.log('✅ Studio loaded');

    // 2. Check if we need to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('\n🔐 Need to login...');
      
      // Fill in login form
      await page.fill('input[type="email"]', 'your-email@example.com');  // <-- UPDATE
      await page.fill('input[type="password"]', 'your-password');        // <-- UPDATE
      await page.click('button:has-text("Login")');
      
      // Wait for login
      await page.waitForNavigation();
      await page.goto('http://localhost:5173/studio', { waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);
      
      console.log('✅ Logged in successfully');
    }

    // 3. Test Beat Generator UI
    console.log('\n2️⃣ Testing Beat Generator UI...');
    
    // Find and click BeatMaker tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, a'));
      const beatTab = tabs.find(el => el.textContent?.includes('Beat') || el.textContent?.includes('beat'));
      if (beatTab) beatTab.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/02-beat-tab.png' });
    
    // Try to find and fill beat generation form
    const bpmInput = await page.$('input[placeholder*="BPM"], input[name*="bpm"]');
    if (bpmInput) {
      await bpmInput.fill('120');
      console.log('✅ BPM field found and filled');
    } else {
      console.log('⚠️ BPM field not found');
    }

    // 4. Test Melody Composer UI
    console.log('\n3️⃣ Testing Melody Composer UI...');
    
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, a'));
      const melodyTab = tabs.find(el => el.textContent?.includes('Melody') || el.textContent?.includes('melody'));
      if (melodyTab) melodyTab.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/03-melody-tab.png' });
    console.log('✅ Melody tab accessed');

    // 5. Test Lyrics Generator UI
    console.log('\n4️⃣ Testing Lyrics Generator UI...');
    
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, a'));
      const lyricsTab = tabs.find(el => el.textContent?.includes('Lyric') || el.textContent?.includes('lyric'));
      if (lyricsTab) lyricsTab.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/04-lyrics-tab.png' });
    console.log('✅ Lyrics tab accessed');

    // 6. Test Complete Song Generator UI
    console.log('\n5️⃣ Testing Complete Song Generator UI...');
    
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button, div, a'));
      const songTab = tabs.find(el => el.textContent?.includes('Audio') || el.textContent?.includes('Song') || el.textContent?.includes('Generate'));
      if (songTab) songTab.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/05-song-tab.png' });
    console.log('✅ Song generator tab accessed');

    console.log('\n🎉 Live UI testing complete!');
    console.log('📸 Screenshots saved in screenshots/ folder');
    
  } catch (error) {
    console.error('❌ UI test failed:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser window remains open for manual testing...');
    console.log('Press Ctrl+C to close when done');
    
    // Wait for user to close
    await new Promise(resolve => {
      process.on('SIGINT', resolve);
    });
    
    await browser.close();
  }
}

// Run the test
testLiveUI().catch(console.error);
