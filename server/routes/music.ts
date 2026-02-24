import express from 'express';
import { generateBassLine, DEFAULT_PROGRESSIONS } from '../services/bassGenerator';

const router = express.Router();

// Smart Bass Generator using Music Theory (INSTANT, NO API NEEDED!)
router.post('/generate-bass', async (req, res) => {
  try {
    const { style, pattern, octave, groove, noteLength, velocity, glide } = req.body;
    let { chordProgression } = req.body;

    // If no chords provided, pick a random common progression
    if (!chordProgression || chordProgression.length === 0) {
      chordProgression = DEFAULT_PROGRESSIONS[Math.floor(Math.random() * DEFAULT_PROGRESSIONS.length)];
    }

    console.log(`🎸 Generating ${style} bass (${pattern} pattern) for ${chordProgression.length} chords`);

    // Generate bass line using music theory algorithms
    // This is INSTANT and FREE - no AI API needed!
    const bassNotes = generateBassLine(
      chordProgression,
      style,
      pattern,
      octave,
      groove,
      noteLength,
      velocity,
      glide
    );

    console.log(`✅ Generated ${bassNotes.length} bass notes`);

    res.json({ bassNotes });

  } catch (error) {
    console.error('Bass generation error:', error);
    res.status(500).json({ error: 'Failed to generate bass line' });
  }
});

export default router;
