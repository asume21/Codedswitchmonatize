import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5000/api';

describe('AI Generation E2E Tests - Live Website', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Show browser window
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Enable console logging
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('error', (err) => console.error('PAGE ERROR:', err));
  });

  afterAll(async () => {
    await browser.close();
  });

  test('1. Navigate to Studio and Login', async () => {
    console.log('🌐 Navigating to studio...');
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle2' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/01-studio-loaded.png' });
    
    console.log('✅ Studio loaded');
  });

  test('2. Test Beat Generator', async () => {
    console.log('🎵 Testing Beat Generator...');
    
    // Click on BeatMaker tab
    await page.click('[data-testid="tab-beatmaker"]');
    await page.waitForTimeout(1000);
    
    // Fill in beat parameters
    await page.fill('input[placeholder*="BPM"]', '120');
    await page.select('select[name="genre"]', 'hip-hop');
    
    // Click generate button
    await page.click('button:has-text("Generate Beat")');
    
    // Wait for generation to complete (up to 60 seconds)
    await page.waitForSelector('[data-testid="beat-output"]', { timeout: 60000 });
    
    // Verify audio URL exists
    const audioUrl = await page.$eval('audio[src]', (el: any) => el.src);
    expect(audioUrl).toMatch(/^https?:\/\//);
    
    await page.screenshot({ path: 'screenshots/02-beat-generated.png' });
    console.log('✅ Beat generated successfully');
  });

  test('3. Test Melody Composer', async () => {
    console.log('🎹 Testing Melody Composer...');
    
    // Click on Melody tab
    await page.click('[data-testid="tab-melody"]');
    await page.waitForTimeout(1000);
    
    // Fill in melody parameters
    await page.select('select[name="genre"]', 'pop');
    await page.select('select[name="mood"]', 'uplifting');
    
    // Click generate button
    await page.click('button:has-text("Generate Melody")');
    
    // Wait for generation
    await page.waitForSelector('[data-testid="melody-output"]', { timeout: 60000 });
    
    const audioUrl = await page.$eval('audio[src]', (el: any) => el.src);
    expect(audioUrl).toMatch(/^https?:\/\//);
    
    await page.screenshot({ path: 'screenshots/03-melody-generated.png' });
    console.log('✅ Melody generated successfully');
  });

  test('4. Test Lyrics Generator', async () => {
    console.log('📝 Testing Lyrics Generator...');
    
    // Click on LyricLab tab
    await page.click('[data-testid="tab-lyriclab"]');
    await page.waitForTimeout(1000);
    
    // Fill in lyrics parameters
    await page.fill('input[name="theme"]', 'love');
    await page.select('select[name="genre"]', 'pop');
    await page.select('select[name="mood"]', 'romantic');
    
    // Click generate button
    await page.click('button:has-text("AI Generate Lyrics")');
    
    // Wait for generation
    await page.waitForSelector('[data-testid="lyrics-output"]', { timeout: 60000 });
    
    const lyrics = await page.$eval('[data-testid="lyrics-output"]', (el: any) => el.textContent);
    expect(lyrics?.length).toBeGreaterThan(0);
    
    await page.screenshot({ path: 'screenshots/04-lyrics-generated.png' });
    console.log('✅ Lyrics generated successfully');
  });

  test('5. Test Complete Song Generator', async () => {
    console.log('🎶 Testing Complete Song Generator...');
    
    // Click on ProAudioGenerator tab
    await page.click('[data-testid="tab-proaudio"]');
    await page.waitForTimeout(1000);
    
    // Fill in song parameters
    await page.fill('textarea[name="songDescription"]', 'A happy upbeat pop song about summer');
    await page.select('select[name="genre"]', 'pop');
    await page.select('select[name="mood"]', 'uplifting');
    
    // Toggle vocals
    await page.click('input[type="checkbox"][name="includeVocals"]');
    
    // Click generate button
    await page.click('button:has-text("Generate Complete Song")');
    
    // Wait for generation (may take longer - up to 8 minutes)
    console.log('⏳ Waiting for complete song generation (this may take a few minutes)...');
    await page.waitForSelector('[data-testid="song-output"]', { timeout: 480000 });
    
    const audioUrl = await page.$eval('audio[src]', (el: any) => el.src);
    expect(audioUrl).toMatch(/^https?:\/\//);
    
    await page.screenshot({ path: 'screenshots/05-song-generated.png' });
    console.log('✅ Complete song generated successfully');
  });

  test('6. Test Authentication - Logout and Try to Generate', async () => {
    console.log('🔐 Testing authentication...');
    
    // Logout
    await page.click('[data-testid="logout-button"]');
    await page.waitForTimeout(2000);
    
    // Try to access studio (should redirect to login)
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle2' });
    
    // Should be on login page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
    
    await page.screenshot({ path: 'screenshots/06-auth-required.png' });
    console.log('✅ Authentication check passed');
  });

  test('7. Test API Error Handling - No Auth', async () => {
    console.log('🚫 Testing API error handling...');
    
    // Try to call API without auth
    const response = await page.evaluate(async () => {
      const res = await fetch('http://localhost:5000/api/beats/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre: 'hip-hop', bpm: 120, duration: 8 })
      });
      return res.status;
    });
    
    expect(response).toBe(401);
    console.log('✅ API correctly returns 401 without auth');
  });

  test('8. Performance - Measure Generation Time', async () => {
    console.log('⏱️ Measuring performance...');
    
    // Login first
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button:has-text("Login")');
    await page.waitForNavigation();
    
    // Go to BeatMaker
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle2' });
    await page.click('[data-testid="tab-beatmaker"]');
    
    // Measure generation time
    const startTime = Date.now();
    
    await page.fill('input[placeholder*="BPM"]', '120');
    await page.select('select[name="genre"]', 'hip-hop');
    await page.click('button:has-text("Generate Beat")');
    
    await page.waitForSelector('[data-testid="beat-output"]', { timeout: 60000 });
    
    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000;
    
    console.log(`⏱️ Beat generation took ${generationTime.toFixed(2)} seconds`);
    expect(generationTime).toBeLessThan(60); // Should complete within 60 seconds
    
    console.log('✅ Performance test passed');
  });
});

// Helper function to wait for element
async function waitForElement(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
}
