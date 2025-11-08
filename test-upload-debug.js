import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { join } from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function debugUpload() {
  console.log('🔍 Starting comprehensive upload debug...');
  
  // Create a real MP3 file
  const testFilePath = join(process.cwd(), 'test-upload.mp3');
  const mp3Header = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00
  ]);
  const fullFile = Buffer.concat([mp3Header, Buffer.alloc(10000)]);
  writeFileSync(testFilePath, fullFile);
  console.log('✅ Created test MP3:', testFilePath, `(${fullFile.length} bytes)`);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true, // Open dev tools automatically
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture ALL console messages
  page.on('console', msg => {
    console.log(`🌐 [${msg.type()}]`, msg.text());
  });
  
  // Capture network requests
  page.on('request', request => {
    if (request.url().includes('upload') || request.url().includes('objects')) {
      console.log('📤 REQUEST:', request.method(), request.url());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('upload') || response.url().includes('objects') || response.url().includes('songs')) {
      console.log('📥 RESPONSE:', response.status(), response.url());
    }
  });
  
  try {
    console.log('\n🌐 Navigating to studio...');
    await page.goto('http://localhost:5180/studio', { waitUntil: 'networkidle2' });
    await delay(2000);
    
    console.log('\n🎵 Looking for Song Uploader tab...');
    const tabs = await page.$$('button, div');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Song Upload')) {
        console.log('✅ Found Song Uploader tab, clicking...');
        await tab.click();
        await delay(2000);
        break;
      }
    }
    
    console.log('\n🔍 Looking for Upload Song button...');
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text.includes('Upload Song')) {
        console.log('✅ Found Upload Song button, clicking...');
        await button.click();
        await delay(2000);
        break;
      }
    }
    
    console.log('\n📁 Waiting for modal and file input...');
    await delay(1000);
    
    // Wait for the modal to be visible
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    const fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      console.error('❌ NO FILE INPUT FOUND!');
      await page.screenshot({ path: 'debug-no-input.png' });
      return;
    }
    
    console.log('✅ Found file input');
    console.log('📤 Uploading file to hidden input...');
    await fileInput.uploadFile(testFilePath);
    await delay(2000);
    
    console.log('✅ File attached to input');
    
    console.log('\n🖱️ Looking for Upload Song button in modal...');
    const modalButtons = await page.$$('button');
    for (const button of modalButtons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text === 'Upload Song') {
        console.log('✅ Clicking Upload Song button...');
        await button.click();
        console.log('\n⏳ MONITORING UPLOAD - CHECK CONSOLE ABOVE FOR NETWORK ACTIVITY');
        break;
      }
    }
    
    // Wait and watch
    for (let i = 0; i < 60; i++) {
      await delay(1000);
      
      // Check for any toast/notification
      const bodyText = await page.evaluate(() => document.body.textContent);
      
      if (bodyText.includes('successfully') || bodyText.includes('Uploaded')) {
        console.log('\n✅✅✅ UPLOAD SUCCESSFUL! ✅✅✅');
        await page.screenshot({ path: 'debug-success.png' });
        await delay(3000);
        return;
      }
      
      if (bodyText.includes('failed') || bodyText.includes('error')) {
        console.log('\n❌ UPLOAD FAILED - CHECK NETWORK LOGS ABOVE');
        await page.screenshot({ path: 'debug-failed.png' });
        await delay(3000);
        return;
      }
      
      if (i % 10 === 0 && i > 0) {
        console.log(`⏱️ Still waiting... (${i}s)`);
      }
    }
    
    console.log('\n⏱️ TIMEOUT - No success or error detected');
    await page.screenshot({ path: 'debug-timeout.png' });
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: 'debug-error.png' });
  } finally {
    await delay(5000);
    await browser.close();
  }
}

debugUpload();
