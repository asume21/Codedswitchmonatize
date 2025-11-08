import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { join } from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testUploadWithLogin() {
  console.log('🚀 Starting upload test with login...');
  
  // Create a test audio file
  const testFilePath = join(process.cwd(), 'test-audio-real.mp3');
  // Create a more realistic MP3 header
  const dummyMp3Data = Buffer.alloc(1024);
  dummyMp3Data.write('ID3', 0);
  writeFileSync(testFilePath, dummyMp3Data);
  console.log('✅ Created test file:', testFilePath);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Listen to console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Upload') || text.includes('upload') || text.includes('error')) {
      console.log('📱 Browser:', text);
    }
  });
  
  try {
    console.log('🌐 Navigating to home page...');
    await page.goto('http://localhost:5179', { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('🔍 Looking for Sign In button...');
    await delay(2000);
    
    const buttons = await page.$$('button, a');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text.includes('Sign In')) {
        console.log('✅ Found Sign In button');
        await button.click();
        await delay(2000);
        break;
      }
    }
    
    // Try to log in (you may need to adjust these credentials)
    console.log('📝 Attempting login...');
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (emailInput && passwordInput) {
      await emailInput.type('test@test.com');
      await passwordInput.type('password123');
      
      // Find and click submit button
      const submitButtons = await page.$$('button[type="submit"], button');
      for (const btn of submitButtons) {
        const btnText = await page.evaluate(el => el.textContent, btn);
        if (btnText && (btnText.includes('Sign In') || btnText.includes('Log In'))) {
          console.log('🔐 Clicking login button...');
          await btn.click();
          await delay(3000);
          break;
        }
      }
    } else {
      console.log('⚠️ Login form not found - may already be logged in');
    }
    
    console.log('🎵 Navigating to studio...');
    await page.goto('http://localhost:5179/studio', { waitUntil: 'networkidle2' });
    await delay(2000);
    
    console.log('🎵 Looking for Song Uploader tab...');
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
        console.log('✅ Found Upload Song button');
        await button.click();
        console.log('🔄 Upload started - waiting for completion...');
        break;
      }
    }
    
    // Wait for upload to complete
    console.log('⏳ Waiting for upload...');
    await delay(5000);
    
    // Check for success
    await page.screenshot({ path: 'upload-result.png' });
    
    const bodyText = await page.evaluate(() => document.body.textContent);
    if (bodyText.includes('Song Uploaded') || bodyText.includes('successfully')) {
      console.log('✅ UPLOAD SUCCESSFUL!');
    } else if (bodyText.includes('error') || bodyText.includes('failed')) {
      console.log('❌ Upload failed');
    } else {
      console.log('⏱️ Upload status unclear - check upload-result.png');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-error.png' });
  } finally {
    await delay(5000);
    await browser.close();
    console.log('✅ Test complete');
  }
}

testUploadWithLogin();
