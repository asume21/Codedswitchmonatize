import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { join } from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testUpload() {
  console.log('🚀 Testing upload with full console logs...\n');
  
  // Create a real MP3 file
  const testFilePath = join(process.cwd(), 'test-song.mp3');
  const mp3Data = Buffer.alloc(50000); // 50KB file
  mp3Data.write('ID3'); // MP3 header
  writeFileSync(testFilePath, mp3Data);
  console.log('✅ Created test file:', testFilePath, `(${mp3Data.length} bytes)\n`);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture ALL console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    // Only show relevant logs
    if (text.includes('upload') || text.includes('Upload') || 
        text.includes('XHR') || text.includes('Error') ||
        text.includes('🚀') || text.includes('📊') || 
        text.includes('✅') || text.includes('❌') ||
        text.includes('Getting') || text.includes('Sending')) {
      console.log(`[BROWSER ${type.toUpperCase()}]`, text);
    }
  });
  
  try {
    console.log('🌐 Navigating to studio...');
    await page.goto('http://localhost:5181/studio', { waitUntil: 'networkidle2' });
    await delay(3000);
    
    console.log('\n📂 Looking for Song Upload tab...');
    const allElements = await page.$$('button, div, span, [role="tab"]');
    let tabFound = false;
    for (const el of allElements) {
      const text = await page.evaluate(e => e.textContent, el);
      if (text && (text.trim() === 'Song Upload' || text.includes('Song Upload'))) {
        console.log('✅ Found Song Upload tab:', text.trim());
        await el.click();
        await delay(3000);
        tabFound = true;
        break;
      }
    }
    
    if (!tabFound) {
      console.error('❌ Song Upload tab not found!');
      await page.screenshot({ path: 'no-tab-found.png' });
      return;
    }
    
    // Verify we're in the Song Upload section
    const pageContent = await page.evaluate(() => document.body.textContent);
    if (!pageContent.includes('Upload Song') && !pageContent.includes('uploaded')) {
      console.error('❌ Not in Song Upload tab content!');
      await page.screenshot({ path: 'wrong-tab.png' });
      return;
    }
    console.log('✅ Song Upload tab content loaded');
    
    console.log('\n🔘 Looking for Upload Song button...');
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(e => e.textContent, btn);
      if (text && text.includes('Upload Song')) {
        console.log('✅ Clicking Upload Song button');
        await btn.click();
        await delay(2000);
        break;
      }
    }
    
    console.log('\n📁 Waiting for file input...');
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    const fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      console.error('❌ File input not found!');
      return;
    }
    
    console.log('✅ File input found');
    console.log('📤 Attaching file...');
    await fileInput.uploadFile(testFilePath);
    await delay(1000);
    
    console.log('\n🖱️ Looking for blue Upload Song button in modal...');
    // Find the button with specific classes (the blue upload button)
    const uploadBtn = await page.$('button.bg-blue-600');
    if (!uploadBtn) {
      console.error('❌ Blue upload button not found!');
      await page.screenshot({ path: 'no-blue-button.png' });
      return;
    }
    
    console.log('✅ Found blue upload button');
    await uploadBtn.click();
    console.log('✅ Blue Upload button clicked!\n');
    console.log('⏳ Waiting for console logs from upload...\n');
    
    // Wait for upload to complete or fail
    await delay(15000);
    
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: 'upload-test-result.png' });
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: 'upload-test-error.png' });
  } finally {
    await delay(3000);
    await browser.close();
    console.log('\n✅ Test complete');
  }
}

testUpload();
