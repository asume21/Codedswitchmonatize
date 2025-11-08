import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { join } from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testActualUpload() {
  console.log('🚀 Starting actual file upload test...');
  
  // Create a small test audio file (just a dummy file for testing)
  const testFilePath = join(process.cwd(), 'test-audio.mp3');
  const dummyMp3Data = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  writeFileSync(testFilePath, dummyMp3Data);
  console.log('✅ Created test file:', testFilePath);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Listen to console logs from the page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('upload') || text.includes('Upload') || text.includes('progress') || text.includes('error')) {
      console.log('📱 Browser console:', text);
    }
  });
  
  try {
    console.log('🌐 Navigating to studio...');
    await page.goto('http://localhost:5179/studio', { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('🎵 Looking for Song Uploader tab...');
    await delay(2000);
    
    const tabs = await page.$$('button, a, div[role="tab"]');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.toLowerCase().includes('song upload')) {
        console.log('✅ Found Song Uploader tab');
        await tab.click();
        await delay(2000);
        break;
      }
    }
    
    console.log('🔍 Looking for upload button...');
    const uploadButtons = await page.$$('button');
    for (const button of uploadButtons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text.toLowerCase().includes('upload song')) {
        console.log('✅ Found upload button');
        await button.click();
        await delay(2000);
        break;
      }
    }
    
    console.log('📁 Looking for file input...');
    const fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      console.error('❌ Could not find file input');
      await page.screenshot({ path: 'no-file-input.png' });
      return;
    }
    
    console.log('✅ Found file input');
    console.log('📤 Uploading test file...');
    
    await fileInput.uploadFile(testFilePath);
    await delay(1000);
    
    console.log('🖱️ Looking for Upload Song button in modal...');
    const modalButtons = await page.$$('button');
    for (const button of modalButtons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text === 'Upload Song') {
        console.log('✅ Found Upload Song button in modal');
        await button.click();
        console.log('🔄 Upload started...');
        break;
      }
    }
    
    // Wait and monitor for progress
    console.log('⏳ Monitoring upload progress...');
    for (let i = 0; i < 30; i++) {
      await delay(1000);
      
      // Check for success or error messages
      const bodyText = await page.evaluate(() => document.body.textContent);
      
      if (bodyText.includes('Upload successful') || bodyText.includes('Song Uploaded')) {
        console.log('✅ Upload succeeded!');
        await page.screenshot({ path: 'upload-success.png' });
        return;
      }
      
      if (bodyText.includes('Upload failed') || bodyText.includes('error')) {
        console.log('❌ Upload failed - see browser console logs above');
        await page.screenshot({ path: 'upload-failed.png' });
        return;
      }
      
      if (i % 5 === 0) {
        console.log(`⏳ Still waiting... (${i}s)`);
      }
    }
    
    console.log('⏱️ Upload timeout - taking screenshot');
    await page.screenshot({ path: 'upload-timeout.png' });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'upload-test-error.png' });
  } finally {
    await delay(3000);
    await browser.close();
    console.log('✅ Test complete');
  }
}

testActualUpload();
