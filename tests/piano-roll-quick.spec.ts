import { test, expect } from '@playwright/test';

// No auth required - we just want screenshots and console errors
test.use({ storageState: { cookies: [], origins: [] } });

test('piano roll visual + error audit', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', err => errors.push('[CRASH] ' + err.message));

  // 1. Land on homepage
  await page.goto('http://localhost:4001/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/step1-home.png' });

  // 2. Try to get to studio - check if we're redirected to login
  await page.goto('http://localhost:4001/studio', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tests/screenshots/step2-studio-or-login.png' });

  const currentUrl = page.url();
  console.log('URL after /studio:', currentUrl);

  // 3. If on login page, log in
  if (currentUrl.includes('login')) {
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('playwright-test@codedswitch.test');
      await passInput.fill('TestPass123!');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 10000 }).catch(() => {});
      await page.goto('http://localhost:4001/studio', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
    }
  }

  await page.screenshot({ path: 'tests/screenshots/step3-studio.png' });
  console.log('Studio URL:', page.url());

  // 4. Find and click piano roll tab
  const tabTexts = ['Piano Roll', 'Melody', 'piano-roll', 'Piano'];
  for (const text of tabTexts) {
    const tab = page.locator(`button:has-text("${text}"), [role="tab"]:has-text("${text}")`).first();
    if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(1500);
      console.log(`Clicked tab: "${text}"`);
      break;
    }
  }

  await page.screenshot({ path: 'tests/screenshots/step4-piano-roll-tab.png' });

  // 5. Inspect what's on screen
  const allButtons = await page.locator('button').allTextContents();
  const allTabs = await page.locator('[role="tab"]').allTextContents();
  console.log('Tabs found:', allTabs);
  console.log('Buttons (first 20):', allButtons.slice(0, 20));

  // 6. Look for the piano roll grid canvas or SVG
  const canvas = page.locator('canvas').first();
  const svgGrid = page.locator('svg').first();
  const hasCanvas = await canvas.isVisible({ timeout: 2000 }).catch(() => false);
  const hasSvg = await svgGrid.isVisible({ timeout: 2000 }).catch(() => false);
  console.log('Has canvas:', hasCanvas, '| Has SVG:', hasSvg);

  // 7. Try clicking in the middle of the page (where grid would be)
  const viewport = page.viewportSize();
  if (viewport) {
    await page.mouse.click(viewport.width * 0.6, viewport.height * 0.5);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/step5-after-click.png' });

    // Try drag (drawing a note)
    await page.mouse.move(viewport.width * 0.5, viewport.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(viewport.width * 0.6, viewport.height * 0.4);
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/step6-after-drag.png' });
  }

  // 8. Report errors
  console.log('\n=== CONSOLE ERRORS ===');
  if (errors.length === 0) {
    console.log('None');
  } else {
    errors.forEach(e => console.log('ERROR:', e));
  }

  console.log('\n=== WARNINGS ===');
  warnings.slice(0, 10).forEach(w => console.log('WARN:', w));

  // Always pass - this is diagnostic only
  expect(true).toBe(true);
});
