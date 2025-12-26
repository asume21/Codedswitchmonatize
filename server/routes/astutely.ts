import { Router, Request, Response } from 'express';
import { unifiedMusicService } from '../services/unifiedMusicService';
import { makeAICall } from '../services/grok';

const router = Router();

// Astutely — the real AI music generation endpoint
router.post('/astutely', async (req: Request, res: Response) => {
  const { style, prompt = '' } = req.body;

  if (!style) {
    return res.status(400).json({ error: 'Style is required' });
  }

  try {
    // AI Generation via Grok (JSON for MIDI/Timeline)
    console.log(`🤖 Astutely generating symbolic pattern for: ${style}`);
    
    const response = await makeAICall([
      {
        role: "system",
        content: `You are Astutely, an expert AI music producer. Generate a full beat arrangement (drums, bass, chords, melody).
Return ONLY valid JSON matching this structure:
{
  "style": "${style}",
  "bpm": 128,
  "key": "C Minor",
  "drums": [{"step": 0, "type": "kick"}, {"step": 4, "type": "snare"}], // 0-63 steps
  "bass": [{"step": 0, "note": 36, "duration": 2}],
  "chords": [{"step": 0, "notes": [60, 63, 67], "duration": 16}],
  "melody": [{"step": 0, "note": 72, "duration": 1}]
}
Ensure patterns are musical and fit the "${style}" genre. Use 64 steps (4 bars).`
      },
      { 
        role: "user", 
        content: `Generate a ${style} beat. ${prompt}` 
      }
    ], {
      response_format: { type: "json_object" },
      temperature: 0.8
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.warn("Astutely JSON parse failed, using fallback pattern");
      // Fallback: Return a basic editable pattern so user can still work manually
      result = {
        style,
        bpm: 120,
        key: "C Minor",
        drums: [
          { step: 0, type: "kick" }, { step: 4, type: "snare" },
          { step: 8, type: "kick" }, { step: 12, type: "snare" },
          { step: 16, type: "kick" }, { step: 20, type: "snare" },
          { step: 24, type: "kick" }, { step: 28, type: "snare" },
          { step: 2, type: "hihat" }, { step: 6, type: "hihat" },
          { step: 10, type: "hihat" }, { step: 14, type: "hihat" }
        ],
        bass: [
          { step: 0, note: 36, duration: 4 },
          { step: 16, note: 36, duration: 4 },
          { step: 32, note: 38, duration: 4 },
          { step: 48, note: 36, duration: 4 }
        ],
        chords: [
          { step: 0, notes: [60, 63, 67], duration: 16 },
          { step: 16, notes: [58, 62, 65], duration: 16 },
          { step: 32, notes: [55, 58, 62], duration: 16 },
          { step: 48, notes: [53, 57, 60], duration: 16 }
        ],
        melody: [
          { step: 0, note: 72, duration: 2 },
          { step: 4, note: 74, duration: 2 },
          { step: 8, note: 75, duration: 4 },
          { step: 16, note: 72, duration: 2 }
        ],
        isFallback: true
      };
    }
    
    return res.json(result);

  } catch (error: any) {
    console.error('Astutely error:', error);
    res.status(500).json({ error: 'AI generation failed: ' + error.message });
  }
});

// Check prediction status
router.get('/astutely/status/:predictionId', async (req: Request, res: Response) => {
  return res.json({ 
    success: true, 
    status: 'succeeded', 
    error: null 
  });
});

export function createAstutelyRoutes() {
  return router;
}

export default router;
