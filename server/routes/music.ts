import express from 'express';

const router = express.Router();

// AI Bass Generator Endpoint
router.post('/generate-bass', async (req, res) => {
  try {
    const { chordProgression, style, pattern, octave, groove, noteLength, velocity, glide } = req.body;

    if (!chordProgression || chordProgression.length === 0) {
      return res.status(400).json({ error: 'Chord progression is required' });
    }

    // Use Grok AI to generate intelligent bass lines
    const XAI_API_KEY = process.env.XAI_API_KEY;
    
    if (!XAI_API_KEY) {
      return res.status(500).json({ error: 'XAI_API_KEY not configured' });
    }

    const prompt = `You are an expert music producer and bassist. Generate a bass line for the following chord progression.

CHORD PROGRESSION:
${chordProgression.map((c: any, i: number) => `${i + 1}. ${c.chord} (${c.duration} beats)`).join('\n')}

BASS STYLE: ${style}
PATTERN TYPE: ${pattern}
OCTAVE: ${octave}
GROOVE: ${groove * 100}%

INSTRUCTIONS:
1. Analyze the chord progression and identify root notes
2. Create a bass line that follows the harmony
3. ${pattern === 'root' ? 'Use only root notes' : ''}
4. ${pattern === 'root-fifth' ? 'Alternate between root and fifth' : ''}
5. ${pattern === 'walking' ? 'Create a walking bass line with chromatic passing tones' : ''}
6. ${pattern === 'arpeggio' ? 'Arpeggiate through chord tones (root, 3rd, 5th, 7th)' : ''}
7. ${pattern === 'rhythmic' ? 'Create syncopated rhythmic patterns' : ''}
8. Match the ${style} bass style characteristics
9. Stay in octave ${octave} range

OUTPUT FORMAT (JSON only, no explanation):
{
  "bassNotes": [
    {
      "note": "C",
      "octave": 2,
      "start": 0,
      "duration": 0.5,
      "velocity": 0.7,
      "glide": 0
    }
  ]
}`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [
          {
            role: 'system',
            content: 'You are a professional music producer specializing in bass line composition. Output only valid JSON, no markdown or explanation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error:', errorText);
      return res.status(500).json({ error: 'Failed to generate bass line with AI' });
    }

    const data = await response.json();
    let bassDataText = data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    bassDataText = bassDataText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let bassData;
    try {
      bassData = JSON.parse(bassDataText);
    } catch (parseError) {
      console.error('Failed to parse Grok response:', bassDataText);
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    // Apply user parameters to generated notes
    if (bassData.bassNotes && Array.isArray(bassData.bassNotes)) {
      bassData.bassNotes = bassData.bassNotes.map((note: any) => ({
        ...note,
        velocity: velocity,
        duration: note.duration * noteLength,
        glide: glide,
        octave: octave, // Force the selected octave
      }));
    }

    res.json(bassData);

  } catch (error) {
    console.error('Bass generation error:', error);
    res.status(500).json({ error: 'Failed to generate bass line' });
  }
});

export default router;
