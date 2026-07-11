import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const outputDir = 'D:/Codedswitchmonatize/marketing/output';
const webmPath = path.join(outputDir, 'organism-capture.webm');
const wavPath = path.join(outputDir, 'organism-capture.wav');

async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log('🚀 Starting browser to record Organism...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Redirect page logs to console so we see internal bridge logging
  page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));

  console.log('🔗 Navigating to Studio...');
  await page.goto('http://127.0.0.1:5001/studio');
  await page.waitForLoadState('load');
  await page.waitForTimeout(5000); // Give Tone.js and client state 5 seconds to settle

  // Verify if window.__audioDebug was found
  const hasDebug = await page.evaluate(() => typeof window.__audioDebug !== 'undefined');
  console.log(`__audioDebug status: ${hasDebug ? 'FOUND' : 'MISSING'}`);

  if (!hasDebug) {
    console.error('❌ Failed: window.__audioDebug is missing! Studio may have failed to boot.');
    await browser.close();
    process.exit(1);
  }

  console.log('🖱️ Clicking Start button to trigger user gesture + play...');
  const startBtn = page.locator('button:has-text("Start"), button[aria-label*="Start"], button:has-text("▶")').first();
  await startBtn.click();

  // Wait a short moment to ensure playback starts
  await page.waitForTimeout(1000);

  const recordDurationMs = 15000;
  console.log(`⏺️ Initiating WebEar audio capture via __audioDebug for ${recordDurationMs / 1000} seconds...`);
  const captureIdPromise = page.evaluate((duration) => {
    return window.__audioDebug.startCapture(duration);
  }, recordDurationMs);

  // Wait for the duration of the recording + 3 seconds buffer for upload
  await page.waitForTimeout(recordDurationMs + 3000);

  const captureId = await captureIdPromise;
  console.log(`📥 Capture completed with capture_id: ${captureId}`);

  console.log(`📡 Downloading raw audio from dev server directly: http://127.0.0.1:4001/api/webear/blob-raw/${captureId}...`);
  const res = await fetch(`http://127.0.0.1:4001/api/webear/blob-raw/${captureId}`);
  if (!res.ok) {
    console.error(`❌ Failed to download audio: Server returned status ${res.status}`);
    await browser.close();
    process.exit(1);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`💾 Saving raw audio to ${webmPath}...`);
  await writeFile(webmPath, buffer);

  console.log('🔄 Converting WebM audio to WAV format using ffmpeg...');
  await run('ffmpeg', [
    '-y',
    '-i', webmPath,
    '-acodec', 'pcm_s16le',
    '-ar', '44100',
    wavPath
  ]);

  console.log(`✅ Success! Recorded audio saved to ${wavPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('❌ Error in script:', err);
  process.exit(1);
});
