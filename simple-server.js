const express = require('express');
const { execSync } = require('child_process');

// Install ts-node if not already installed
try {
  require.resolve('ts-node');
} catch (e) {
  execSync('npm install ts-node typescript @types/node', { stdio: 'inherit' });
}

// Dynamically import the generateMelody function
async function startServer() {
  try {
    const { generateMelody } = await import('./server/services/grok.ts');
    
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
      console.log('Simple test server listening on port 5000');
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

startServer();
