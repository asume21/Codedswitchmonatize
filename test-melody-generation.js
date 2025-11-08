import puppeteer from 'puppeteer';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to the app
    console.log('🌐 Navigating to localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the app to load
    await delay(2000);

    // Check if we need to login
    console.log('🔍 Checking for login...');
    const buttons = await page.$$('button');
    let foundLogin = false;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Login') || text.includes('Sign')) {
        console.log('📝 Logging in...');
        await btn.click();
        await delay(1000);
        foundLogin = true;
        break;
      }
    }
    if (!foundLogin) {
      console.log('✅ Already logged in or no login required');
    }

    // Navigate to studio
    console.log('🎵 Navigating to studio...');
    await page.goto('http://localhost:5173/studio', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Look for Melody Composer tab - try multiple selectors
    console.log('🎹 Looking for Melody Composer tab...');
    let tabs = await page.$$('[role="tab"]');
    
    if (tabs.length === 0) {
      console.log('No tabs with role="tab" found, trying button selectors...');
      tabs = await page.$$('button[class*="tab"]');
    }
    
    if (tabs.length === 0) {
      console.log('No tabs found, trying all clickable elements...');
      tabs = await page.$$('div[class*="tab"], button');
    }

    let melodyTab = null;

    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text.toLowerCase().includes('melody') || text.toLowerCase().includes('composer')) {
        console.log(`✅ Found Melody tab: "${text}"`);
        melodyTab = tab;
        break;
      }
    }

    if (!melodyTab) {
      console.log('❌ Melody Composer tab not found');
      console.log(`Available tabs (${tabs.length} total):`);
      for (let i = 0; i < Math.min(tabs.length, 20); i++) {
        const tab = tabs[i];
        const text = await page.evaluate(el => el.textContent, tab);
        if (text.trim()) console.log(`  ${i + 1}. ${text.trim()}`);
      }
      
      // Show page structure
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('\n📄 Page content preview:');
      console.log(pageText.substring(0, 1000));
      
      await browser.close();
      return;
    }

    // Click Melody Composer tab
    console.log('🖱️ Clicking Melody Composer tab...');
    try {
      await melodyTab.click();
    } catch (e) {
      console.log('Direct click failed, trying via page.click...');
      await page.evaluate(el => el.click(), melodyTab);
    }
    await delay(3000);

    // Look for generate button
    console.log('🔍 Looking for generate button...');
    const allButtons = await page.$$('button');
    let generateBtn = null;

    for (const btn of allButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Generate') || text.includes('AI') || text.includes('Compose')) {
        console.log(`✅ Found button: "${text}"`);
        generateBtn = btn;
        break;
      }
    }

    if (!generateBtn) {
      console.log('❌ Generate button not found');
      console.log('Available buttons:');
      for (const btn of allButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.trim()) console.log(`  - ${text.trim()}`);
      }
      await browser.close();
      return;
    }

    // Click generate button
    console.log('🎬 Clicking generate button...');
    await generateBtn.click();

    // Wait for generation to complete (with timeout)
    console.log('⏳ Waiting for melody generation...');
    let generationComplete = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    while (!generationComplete && attempts < maxAttempts) {
      await delay(1000);
      attempts++;

      // Check for success or error messages in the page
      const pageText = await page.evaluate(() => document.body.innerText);
      
      if (pageText.includes('Melody Generated') || pageText.includes('Added') && pageText.includes('notes')) {
        console.log('✅ SUCCESS! Melody generated successfully');
        generationComplete = true;
        break;
      }

      if (pageText.includes('Generation Failed') || pageText.includes('Could not generate')) {
        console.log('❌ FAILED! Generation failed');
        console.log('Error details:', pageText.substring(0, 500));
        generationComplete = true;
        break;
      }

      if (attempts % 10 === 0) {
        console.log(`⏳ Still waiting... (${attempts}s)`);
      }
    }

    if (!generationComplete) {
      console.log('❌ TIMEOUT! Generation took too long');
    }

    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'melody-generation-result.png' });
    console.log('✅ Screenshot saved: melody-generation-result.png');

    // Get console logs from page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 Page error:', msg.text());
      }
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
    console.log('✅ Test complete');
  }
})();
