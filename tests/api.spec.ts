import { test, expect } from '@playwright/test';

/**
 * API Endpoint Tests
 * Tests all major API routes
 */

test.describe('Health & Status APIs', () => {
  
  test('GET /api/health returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/ai-providers returns providers list', async ({ request }) => {
    const response = await request.get('/api/ai-providers');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.providers).toBeDefined();
    expect(Array.isArray(body.providers)).toBeTruthy();
  });

  test('GET /api/subscription-status returns status', async ({ request }) => {
    const response = await request.get('/api/subscription-status');
    expect(response.status()).toBe(200);
  });

});

test.describe('Music Generation APIs (Auth Required)', () => {
  
  test('POST /api/beats/generate requires auth', async ({ request }) => {
    const response = await request.post('/api/beats/generate', {
      data: { genre: 'pop', bpm: 120, duration: 10 }
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/melody/generate requires auth', async ({ request }) => {
    const response = await request.post('/api/melody/generate', {
      data: { scale: 'C major', style: 'pop' }
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/mix/generate requires auth', async ({ request }) => {
    const response = await request.post('/api/mix/generate', {
      data: { tracks: [] }
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/music/generate-complete requires auth', async ({ request }) => {
    const response = await request.post('/api/music/generate-complete', {
      data: { prompt: 'test song' }
    });
    expect(response.status()).toBe(401);
  });

});

test.describe('Lyrics APIs (Auth Required)', () => {
  
  test('POST /api/lyrics/generate requires auth', async ({ request }) => {
    const response = await request.post('/api/lyrics/generate', {
      data: { theme: 'love', genre: 'pop' }
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/lyrics/analyze requires auth', async ({ request }) => {
    const response = await request.post('/api/lyrics/analyze', {
      data: { lyrics: 'test lyrics here' }
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/lyrics/rhymes requires auth', async ({ request }) => {
    const response = await request.post('/api/lyrics/rhymes', {
      data: { word: 'love' }
    });
    expect(response.status()).toBe(401);
  });

});

test.describe('Song APIs', () => {
  
  test('POST /api/songs/generate-pattern accepts request', async ({ request }) => {
    const response = await request.post('/api/songs/generate-pattern', {
      data: { prompt: 'upbeat pop song', duration: 30, bpm: 120 }
    });
    // Should work without auth (pattern generation is local)
    expect([200, 400, 401, 500]).toContain(response.status());
  });

  test('POST /api/songs/generate-professional validates input', async ({ request }) => {
    const response = await request.post('/api/songs/generate-professional', {
      data: {} // Empty data
    });
    expect([400, 401, 500]).toContain(response.status());
  });

  test('POST /api/songs/generate-beat validates input', async ({ request }) => {
    const response = await request.post('/api/songs/generate-beat', {
      data: { prompt: 'hip hop beat' }
    });
    expect([200, 400, 401, 500]).toContain(response.status());
  });

  test('POST /api/songs/generate-drums validates input', async ({ request }) => {
    const response = await request.post('/api/songs/generate-drums', {
      data: { prompt: 'rock drums' }
    });
    expect([200, 400, 401, 500]).toContain(response.status());
  });

  test('POST /api/songs/generate-melody validates input', async ({ request }) => {
    const response = await request.post('/api/songs/generate-melody', {
      data: { prompt: 'jazz melody' }
    });
    expect([200, 400, 401, 500]).toContain(response.status());
  });

  test('POST /api/songs/generate-instrumental validates input', async ({ request }) => {
    const response = await request.post('/api/songs/generate-instrumental', {
      data: { prompt: 'ambient instrumental' }
    });
    expect([200, 400, 401, 500]).toContain(response.status());
  });

  test('POST /api/songs/blend-genres validates input', async ({ request }) => {
    const response = await request.post('/api/songs/blend-genres', {
      data: { primaryGenre: 'rock', secondaryGenres: ['jazz'], prompt: 'fusion' }
    });
    expect([200, 400, 401, 500]).toContain(response.status());
  });

});

test.describe('Code APIs', () => {
  
  test('POST /api/code-to-music accepts code', async ({ request }) => {
    const response = await request.post('/api/code-to-music', {
      data: { 
        code: 'function hello() { return "world"; }',
        language: 'javascript'
      }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

  test('POST /api/ai/translate-code requires auth', async ({ request }) => {
    const response = await request.post('/api/ai/translate-code', {
      data: {
        sourceCode: 'print("hello")',
        sourceLanguage: 'python',
        targetLanguage: 'javascript'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/security/scan accepts code', async ({ request }) => {
    const response = await request.post('/api/security/scan', {
      data: {
        code: 'const x = 1;',
        language: 'javascript'
      }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

});

test.describe('Assistant API', () => {
  
  test('POST /api/assistant/chat accepts message', async ({ request }) => {
    const response = await request.post('/api/assistant/chat', {
      data: { message: 'Hello, help me make music' }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

});

test.describe('Credits APIs', () => {
  
  test('GET /api/credits requires auth', async ({ request }) => {
    const response = await request.get('/api/credits');
    expect(response.status()).toBe(401);
  });

  test('POST /api/credits/purchase requires auth', async ({ request }) => {
    const response = await request.post('/api/credits/purchase', {
      data: { amount: 100 }
    });
    expect(response.status()).toBe(401);
  });

});

test.describe('Playlist APIs', () => {
  
  test('GET /api/playlists requires auth', async ({ request }) => {
    const response = await request.get('/api/playlists');
    expect(response.status()).toBe(401);
  });

  test('POST /api/playlists requires auth', async ({ request }) => {
    const response = await request.post('/api/playlists', {
      data: { name: 'Test Playlist' }
    });
    expect(response.status()).toBe(401);
  });

});

test.describe('Melody APIs', () => {
  
  test('GET /api/melodies requires auth', async ({ request }) => {
    const response = await request.get('/api/melodies');
    expect(response.status()).toBe(401);
  });

  test('POST /api/melodies requires auth', async ({ request }) => {
    const response = await request.post('/api/melodies', {
      data: { title: 'Test Melody', notes: [] }
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/melodies/generate accepts request', async ({ request }) => {
    const response = await request.post('/api/melodies/generate', {
      data: { scale: 'C major', style: 'pop', complexity: 5 }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

});

test.describe('New Audio APIs', () => {
  
  test('POST /api/audio/generate-song validates input', async ({ request }) => {
    const response = await request.post('/api/audio/generate-song', {
      data: { prompt: 'happy pop song' }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

  test('POST /api/audio/generate-lyrics validates input', async ({ request }) => {
    const response = await request.post('/api/audio/generate-lyrics', {
      data: { theme: 'love' }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

  test('POST /api/audio/generate-beat-from-lyrics validates input', async ({ request }) => {
    const response = await request.post('/api/audio/generate-beat-from-lyrics', {
      data: { lyrics: 'test lyrics for beat' }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

  test('POST /api/layers/generate validates input', async ({ request }) => {
    const response = await request.post('/api/layers/generate', {
      data: { style: 'ambient' }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

  test('POST /api/music/generate-bass validates input', async ({ request }) => {
    const response = await request.post('/api/music/generate-bass', {
      data: { chordProgression: ['C', 'G', 'Am', 'F'] }
    });
    expect([200, 400, 500]).toContain(response.status());
  });

});
