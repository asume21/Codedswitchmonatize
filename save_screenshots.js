import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotsDir = path.join(__dirname, 'website_screenshots');

// Create directory if it doesn't exist
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const pages = [
  { url: 'https://www.codedswitch.com', name: '01_homepage.png' },
  { url: 'https://www.codedswitch.com/studio', name: '02_studio_beatmaker.png' },
  { url: 'https://www.codedswitch.com/song-uploader', name: '03_song_uploader.png' },
  { url: 'https://www.codedswitch.com/studio?tab=melody', name: '04_melody_composer.png' },
  { url: 'https://www.codedswitch.com/studio?tab=mixer', name: '05_professional_mixer.png' },
  { url: 'https://www.codedswitch.com/studio?tab=mix-studio', name: '06_mix_studio.png' },
  { url: 'https://www.codedswitch.com/studio?tab=pro-console', name: '07_unified_studio.png' },
  { url: 'https://www.codedswitch.com/dashboard', name: '08_dashboard.png' },
];

(async () => {
  const browser = await puppeteer.launch();
  
  for (const page of pages) {
    try {
      const browserPage = await browser.newPage();
      await browserPage.setViewport({ width: 1920, height: 1080 });
      await browserPage.goto(page.url, { waitUntil: 'networkidle2' });
      
      const screenshotPath = path.join(screenshotsDir, page.name);
      await browserPage.screenshot({ path: screenshotPath, fullPage: false });
      
      console.log(`✅ Saved: ${page.name}`);
      await browserPage.close();
    } catch (error) {
      console.error(`❌ Error saving ${page.name}:`, error.message);
    }
  }
  
  await browser.close();
  console.log('✅ All screenshots saved to:', screenshotsDir);
})();
