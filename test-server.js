const express = require('express');
const { generateMelody } = require('./server/services/grok.ts');

const app = express();
app.use(express.json());

app.post('/api/melodies/generate', async (req, res) => {
  try {
    const { scale, style, complexity, availableTracks, musicalParams } = req.body;
    if (!scale || !style) {
      return res.status(400).json({ message: "Scale and style are required" });
    }
    
    console.log(`🎵 Generating melody: ${style} in ${scale}, complexity: ${complexity}`);
    const result = await generateMelody(scale, style, complexity || 5, availableTracks, musicalParams);
    res.json(result);
  } catch (err) {
    console.error("Melody generation error:", err);
    res.status(500).json({ message: err?.message || "Failed to generate melody" });
  }
});

app.listen(5000, 'localhost', () => {
  console.log('Test server listening on port 5000');
});
