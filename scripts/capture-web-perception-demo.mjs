import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(repoRoot, 'marketing', 'web-perception-demo.html');
const outputDir = path.join(repoRoot, 'marketing', 'output');
const rawDir = path.join(outputDir, 'raw-video');
const webmPath = path.join(outputDir, 'web-perception-demo.webm');
const mp4Path = path.join(outputDir, 'web-perception-demo.mp4');

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await mkdir(outputDir, { recursive: true });
await rm(rawDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: rawDir,
    size: { width: 1920, height: 1080 },
  },
});

const page = await context.newPage();
await page.goto(pathToFileURL(htmlPath).href);
await page.waitForFunction(() => window.__demoDone === true, undefined, { timeout: 35000 });
await page.waitForTimeout(500);

const video = page.video();
await page.close();
await context.close();
await browser.close();

const rawVideoPath = await video.path();
await copyFile(rawVideoPath, webmPath);

await run('ffmpeg', [
  '-y',
  '-i', webmPath,
  '-vf', 'format=yuv420p',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-movflags', '+faststart',
  mp4Path,
]);

await rm(rawDir, { recursive: true, force: true });

console.log(`Wrote ${webmPath}`);
console.log(`Wrote ${mp4Path}`);
