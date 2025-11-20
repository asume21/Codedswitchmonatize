import { test, expect, Browser, Page } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5000/api';

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

let browser: Browser;
let page: Page;
let authToken: string;

test.describe('AI Generation APIs - Authentication & Authorization', () => {
  test.beforeAll(async () => {
    // Setup: Create test user and get auth token
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });
    
    if (loginResponse.ok) {
      const data = await loginResponse.json();
      authToken = data.token;
    }
  });

  test('1. Beat Generator - Requires Authentication', async () => {
    // Test without auth - should fail
    const noAuthResponse = await fetch(`${API_BASE}/beats/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre: 'hip-hop', bpm: 120, duration: 8 }),
    });
    expect(noAuthResponse.status).toBe(401);

    // Test with auth - should succeed
    const withAuthResponse = await fetch(`${API_BASE}/beats/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ genre: 'hip-hop', bpm: 120, duration: 8 }),
    });
    expect(withAuthResponse.status).toBe(200);
    const data = await withAuthResponse.json();
    expect(data.success).toBe(true);
    expect(data.beat).toBeDefined();
    expect(data.beat.audioUrl).toBeDefined();
  });

  test('2. Melody Composer - Requires Authentication', async () => {
    const response = await fetch(`${API_BASE}/melody/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ genre: 'pop', mood: 'uplifting' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data?.audioUrl).toBeDefined();
  });

  test('3. Pack Generator - Requires Authentication', async () => {
    const response = await fetch(`${API_BASE}/music/generate-with-musicgen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt: 'electronic beat', duration: 10 }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.audioUrl).toBeDefined();
  });

  test('4. Lyrics Generator - Requires Authentication', async () => {
    const response = await fetch(`${API_BASE}/lyrics/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ theme: 'love', genre: 'pop', mood: 'romantic' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.content || data.lyrics).toBeDefined();
  });

  test('5. Lyrics to Beat - Requires Authentication', async () => {
    const response = await fetch(`${API_BASE}/lyrics/generate-beat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ lyrics: 'test lyrics', genre: 'hip-hop' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pattern).toBeDefined();
  });

  test('6. Lyrics to Music - Requires Authentication', async () => {
    const response = await fetch(`${API_BASE}/lyrics/generate-music`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ lyrics: 'test lyrics', style: 'pop' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.audioUrl).toBeDefined();
  });

  test('7. Complete Song - Requires Authentication', async () => {
    const response = await fetch(`${API_BASE}/music/generate-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ songDescription: 'happy pop song', includeVocals: true }),
    });
    // May timeout, but should not return 401
    expect(response.status).not.toBe(401);
  });

  test('8. ChatMusician - Requires Authentication', async () => {
    const response = await fetch(`${API_BASE}/chatmusician/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt: 'happy melody', style: 'classical' }),
    });
    expect(response.status).not.toBe(401);
  });

  test('All AI APIs return 401 without authentication', async () => {
    const endpoints = [
      { path: '/beats/generate', body: { genre: 'hip-hop', bpm: 120, duration: 8 } },
      { path: '/melody/generate', body: { genre: 'pop', mood: 'uplifting' } },
      { path: '/music/generate-with-musicgen', body: { prompt: 'beat', duration: 10 } },
      { path: '/lyrics/generate', body: { theme: 'love', genre: 'pop' } },
      { path: '/lyrics/generate-beat', body: { lyrics: 'test', genre: 'hip-hop' } },
      { path: '/lyrics/generate-music', body: { lyrics: 'test', style: 'pop' } },
      { path: '/music/generate-complete', body: { songDescription: 'song' } },
      { path: '/chatmusician/generate', body: { prompt: 'melody', style: 'classical' } },
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endpoint.body),
      });
      expect(response.status).toBe(401);
    }
  });
});

test.describe('AI Generation APIs - Response Validation', () => {
  test('Beat Generator returns valid audio URL', async () => {
    const response = await fetch(`${API_BASE}/beats/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ genre: 'trap', bpm: 140, duration: 16 }),
    });
    
    const data = await response.json();
    expect(data.beat.audioUrl).toMatch(/^https?:\/\//);
    expect(data.beat.bpm).toBe(140);
    expect(data.beat.genre).toBe('trap');
  });

  test('Melody Composer returns valid audio URL', async () => {
    const response = await fetch(`${API_BASE}/melody/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ genre: 'jazz', mood: 'melancholic', key: 'D minor' }),
    });
    
    const data = await response.json();
    expect(data.data.audioUrl).toMatch(/^https?:\/\//);
    expect(data.data.genre).toBe('jazz');
  });

  test('Lyrics Generator returns text content', async () => {
    const response = await fetch(`${API_BASE}/lyrics/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ theme: 'freedom', genre: 'rock', mood: 'energetic' }),
    });
    
    const data = await response.json();
    const content = data.content || data.lyrics;
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
  });

  test('Lyrics to Beat returns beat pattern', async () => {
    const response = await fetch(`${API_BASE}/lyrics/generate-beat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ lyrics: 'I love the way you move', genre: 'house' }),
    });
    
    const data = await response.json();
    expect(data.pattern).toBeDefined();
    expect(data.pattern.kick).toBeDefined();
    expect(data.pattern.snare).toBeDefined();
    expect(data.bpm).toBeGreaterThan(0);
  });
});
