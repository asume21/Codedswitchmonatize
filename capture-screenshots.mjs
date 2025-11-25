/* eslint-env node */
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
  // Main Pages
  { url: 'https://www.codedswitch.com', name: '01_homepage.png', wait: 2000 },
  { url: 'https://www.codedswitch.com/dashboard', name: '02_dashboard.png', wait: 2000 },
  { url: 'https://www.codedswitch.com/pricing', name: '03_pricing.png', wait: 2000 },
  
  // Studio - Beat Maker
  { url: 'https://www.codedswitch.com/studio', name: '04_studio_beatmaker.png', wait: 3000 },
  
  // Music Studio
  { url: 'https://www.codedswitch.com/music-studio', name: '05_music_studio.png', wait: 2000 },
  
  // Mix Studio
  { url: 'https://www.codedswitch.com/mix-studio', name: '06_mix_studio.png', wait: 2000 },
  
  // Pro Console
  { url: 'https://www.codedswitch.com/pro-console', name: '07_pro_console_unified_studio.png', wait: 2000 },
  
  // MIDI Controller
  { url: 'https://www.codedswitch.com/midi-controller', name: '08_midi_controller.png', wait: 2000 },
  
  // Song Uploader
  { url: 'https://www.codedswitch.com/song-uploader', name: '09_song_uploader.png', wait: 2000 },
  
  // Beat Maker (standalone)
  { url: 'https://www.codedswitch.com/beat-maker', name: '10_beat_maker.png', wait: 2000 },
  
  // Melody Composer
  { url: 'https://www.codedswitch.com/melody-composer', name: '11_melody_composer.png', wait: 2000 },
  
  // Code Translator
  { url: 'https://www.codedswitch.com/code-translator', name: '12_code_translator.png', wait: 2000 },
  
  // Code to Music
  { url: 'https://www.codedswitch.com/code-to-music', name: '13_code_to_music.png', wait: 2000 },
  
  // Music to Code
  { url: 'https://www.codedswitch.com/music-to-code', name: '14_music_to_code.png', wait: 2000 },
  
  // Lyric Lab
  { url: 'https://www.codedswitch.com/lyric-lab', name: '15_lyric_lab.png', wait: 2000 },
  
  // Vulnerability Scanner
  { url: 'https://www.codedswitch.com/vulnerability-scanner', name: '16_vulnerability_scanner.png', wait: 2000 },
  
  // AI Assistant
  { url: 'https://www.codedswitch.com/ai-assistant', name: '17_ai_assistant.png', wait: 2000 },
  
  // Pack Generator
  { url: 'https://www.codedswitch.com/pack-generator', name: '18_pack_generator.png', wait: 2000 },
  
  // Advanced Sequencer
  { url: 'https://www.codedswitch.com/advanced-sequencer', name: '19_advanced_sequencer.png', wait: 2000 },
  
  // Granular Engine
  { url: 'https://www.codedswitch.com/granular-engine', name: '20_granular_engine.png', wait: 2000 },
  
  // Wavetable Oscillator
  { url: 'https://www.codedswitch.com/wavetable-synth', name: '21_wavetable_synth.png', wait: 2000 },
  
  // Song Structure Manager
  { url: 'https://www.codedswitch.com/song-structure', name: '22_song_structure.png', wait: 2000 },
  
  // Dynamic Layering
  { url: 'https://www.codedswitch.com/dynamic-layering', name: '23_dynamic_layering.png', wait: 2000 },
  
  // Performance Metrics
  { url: 'https://www.codedswitch.com/performance-metrics', name: '24_performance_metrics.png', wait: 2000 },
  
  // Output Sequencer
  { url: 'https://www.codedswitch.com/output-sequencer', name: '25_output_sequencer.png', wait: 2000 },
  
  // Professional Studio
  { url: 'https://www.codedswitch.com/professional-studio', name: '26_professional_studio.png', wait: 2000 },
  
  // Professional Mixer
  { url: 'https://www.codedswitch.com/professional-mixer', name: '27_professional_mixer.png', wait: 2000 },
  
  // Vertical Piano Roll
  { url: 'https://www.codedswitch.com/vertical-piano-roll', name: '28_vertical_piano_roll.png', wait: 2000 },
  
  // Pro Audio
  { url: 'https://www.codedswitch.com/pro-audio', name: '29_pro_audio.png', wait: 2000 },
];

console.log('🎬 Starting screenshot capture...\n');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const page of pages) {
    try {
      console.log(`📸 Capturing: ${page.name}...`);
      const browserPage = await browser.newPage();
      
      // Go to URL
      await browserPage.goto(page.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for additional time if specified
      if (page.wait) {
        await new Promise(resolve => setTimeout(resolve, page.wait));
      }
      
      // Take screenshot
      const screenshotPath = path.join(screenshotsDir, page.name);
      await browserPage.screenshot({ 
        path: screenshotPath,
        fullPage: false
      });
      
      console.log(`   ✅ Saved: ${screenshotPath}`);
      successCount++;
      
      await browserPage.close();
      
      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Error capturing ${page.name}:`, error.message);
      errorCount++;
    }
  }
  
  await browser.close();
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${successCount} screenshots`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📁 Saved to: ${screenshotsDir}`);
  console.log('='.repeat(50));
  
})();
