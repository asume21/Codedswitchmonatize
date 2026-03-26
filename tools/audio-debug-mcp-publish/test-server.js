import express from 'express';
import { webearMiddleware } from './dist/middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use('/api/webear', webearMiddleware({ devOnly: false }));

app.get('/client-snippet.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client-snippet.js'));
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Audio Debug Test</title>
        <script src="/client-snippet.js"></script>
        <style>body { font-family: sans-serif; padding: 2rem; background: #1a1a1a; color: white; }</style>
      </head>
      <body>
        <h1>Audio Debug Test</h1>
        <p>1. Select an MP3 or WAV file below to play it.<br/>
           2. Once it starts playing, tell Antigravity "I'm playing music!"<br/>
           3. Antigravity will capture the audio and analyze it.</p>
        
        <input type="file" id="audioUpload" accept="audio/*" style="margin-bottom: 20px" />
        <br/>
        <audio id="audioPlayer" controls></audio>

        <script>
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const player = document.getElementById('audioPlayer');
          const upload = document.getElementById('audioUpload');
          let sourceConnected = false;
          
          upload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
              player.src = URL.createObjectURL(file);
              player.play();
              
              if (!sourceConnected) {
                 const track = audioCtx.createMediaElementSource(player);
                 const gain = audioCtx.createGain();
                 track.connect(gain);
                 gain.connect(audioCtx.destination);
                 
                 // Init the MCP bridge on this audio context
                 WebEar.init({
                   audioContext: audioCtx,
                   outputNode: gain,
                   devOnly: false
                 });
                 sourceConnected = true;
              }
            }
          });
          
          player.addEventListener('play', () => {
             if (audioCtx.state === 'suspended') {
                audioCtx.resume();
             }
          });
        </script>
      </body>
    </html>
  `);
});

app.listen(5050, () => {
  console.log('Test server running on http://localhost:5050');
});
