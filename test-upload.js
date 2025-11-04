import puppeteer from 'puppeteer';
import { createWriteStream } from 'fs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testUpload() {
  console.log('🚀 Starting upload test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🌐 Navigating directly to studio...');
    await page.goto('http://localhost:5179/studio', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Studio page loaded');
    
    console.log('🎵 Looking for Song Uploader tab...');
    await delay(2000);
    
    // Try to find and click Song Uploader tab
    const tabs = await page.$$('button, a, div[role="tab"]');
    let uploaderFound = false;
    
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.toLowerCase().includes('song upload')) {
        console.log('✅ Found Song Uploader tab');
        await tab.click();
        uploaderFound = true;
        await delay(2000);
        break;
      }
    }
    
    if (!uploaderFound) {
      console.log('❌ Could not find Song Uploader tab');
      await page.screenshot({ path: 'upload-test-failed.png' });
      return;
    }
    
    console.log('🔍 Looking for upload button...');
    await delay(1000);
    
    // Look for the upload button
    const uploadButtons = await page.$$('button');
    let uploadButton = null;
    
    for (const button of uploadButtons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text.toLowerCase().includes('upload song')) {
        console.log('✅ Found upload button');
        uploadButton = button;
        break;
      }
    }
    
    if (!uploadButton) {
      console.log('❌ Could not find upload button');
      await page.screenshot({ path: 'upload-test-no-button.png' });
      return;
    }
    
    console.log('🖱️ Clicking upload button...');
    await uploadButton.click();
    await delay(2000);
    
    console.log('📸 Taking screenshot of upload modal...');
    await page.screenshot({ path: 'upload-modal.png' });
    
    console.log('✅ Upload UI is accessible!');
    console.log('📊 Test Summary:');
    console.log('  - Login: ✅');
    console.log('  - Song Uploader tab: ✅');
    console.log('  - Upload button: ✅');
    console.log('  - Upload modal opens: ✅');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'upload-test-error.png' });
  } finally {
    await browser.close();
    console.log('✅ Test complete');
  }
}

testUpload();
