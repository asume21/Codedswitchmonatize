/* eslint-env node */
const puppeteer = require('puppeteer');

async function checkPage() {
  try {
    console.log('Starting Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log('Opening page...');
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to the app
    await page.goto('http://localhost:3211', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('Page loaded, checking content...');

    // Wait a bit for React to load
    await page.waitForTimeout(5000);

    // Check if there's any visible content
    const bodyText = await page.evaluate(() => {
      const body = document.body;
      return {
        text: body.textContent?.substring(0, 200) || '',
        hasChildren: body.children.length > 0,
        backgroundColor: window.getComputedStyle(body).backgroundColor,
        display: window.getComputedStyle(body).display
      };
    });

    console.log('Page content:', bodyText);

    // Check for any error messages
    const errorElements = await page.$$('[class*="error"], [class*="Error"]');
    console.log('Error elements found:', errorElements.length);

    // Take a screenshot
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
    console.log('Screenshot saved as debug-screenshot.png');

    await browser.close();
    console.log('Browser closed successfully');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPage();
