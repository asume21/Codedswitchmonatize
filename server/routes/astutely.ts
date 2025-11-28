import { Router, Request, Response } from 'express';

const router = Router();

const {
  REPLICATE_API_TOKEN,
  OPENAI_API_KEY,
  HUGGINGFACE_API_TOKEN
} = process.env;

// Astutely — the real AI music generation endpoint
router.post('/astutely', async (req: Request, res: Response) => {
  const { style, prompt = '' } = req.body;

  if (!style) {
    return res.status(400).json({ error: 'Style is required' });
  }

  try {
    // 1. Replicate + MusicGen for drums / full beats
    if (style.toLowerCase().includes('drum') || style.toLowerCase().includes('beat')) {
      if (!REPLICATE_API_TOKEN) {
        return res.status(500).json({ error: 'Replicate API not configured' });
      }

      const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: "671ac645ce5e552cc63a54a2bbff63fcf798043055f2a26f81679d68f568e05e", // MusicGen stereo
          input: { 
            prompt: `${style} beat, 128 BPM, professional mix, high quality`,
            duration: 8
          }
        })
      });
      const data = await replicateRes.json();
      return res.json({ success: true, audioUrl: data.output, predictionId: data.id });
    }

    // 2. OpenAI for chords / melody
    if (style.toLowerCase().includes('chord') || style.toLowerCase().includes('melody')) {
      if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API not configured' });
      }

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ 
            role: "user", 
            content: `Generate a ${style} in C minor, 128 BPM. Return ONLY valid JSON: { "notes": [60,62,...], "durations": [0.5,0.5,...] }` 
          }]
        })
      });
      const data = await openaiRes.json();
      
      try {
        const content = data.choices?.[0]?.message?.content || '{}';
        // Extract JSON from potential markdown code blocks
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
        return res.json({ success: true, ...result });
      } catch (parseError) {
        return res.json({ success: true, notes: [60, 63, 67, 72], durations: [0.5, 0.5, 0.5, 0.5] });
      }
    }

    // 3. Hugging Face + MusicGen as fallback
    if (!HUGGINGFACE_API_TOKEN) {
      return res.status(500).json({ error: 'Hugging Face API not configured' });
    }

    const hfRes = await fetch('https://api-inference.huggingface.co/models/facebook/musicgen-medium', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HUGGINGFACE_API_TOKEN}` },
      body: JSON.stringify({ inputs: `${style} beat, 128 BPM, ${prompt}` })
    });

    if (!hfRes.ok) {
      const errorText = await hfRes.text();
      console.error('HuggingFace error:', errorText);
      return res.status(500).json({ error: 'HuggingFace generation failed' });
    }

    const arrayBuffer = await hfRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.set('Content-Type', 'audio/wav');
    return res.send(buffer);

  } catch (error) {
    console.error('Astutely error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

// Check prediction status (for Replicate async jobs)
router.get('/astutely/status/:predictionId', async (req: Request, res: Response) => {
  const { predictionId } = req.params;

  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'Replicate API not configured' });
  }

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }
    });
    const data = await response.json();
    return res.json({ 
      success: true, 
      status: data.status, 
      audioUrl: data.output,
      error: data.error 
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

export function createAstutelyRoutes() {
  return router;
}

export default router;
