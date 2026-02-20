# Audio Analysis API

Standalone microservice for audio analysis features used by the CodedSwitch voice conversion pipeline.

## Features

- **Pitch Extraction** — Extract F0 pitch contour using RMVPE
- **Pitch Correction** — Auto-tune vocals to a musical scale
- **Melody Extraction** — Convert vocal pitch to MIDI notes
- **Karaoke Scoring** — Score sung vocals against reference melody
- **Emotion Detection** — Classify vocal emotion from audio features
- **Audio Classification** — Identify audio type (vocals, instrumental, speech, etc.)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (returns GPU status) |
| POST | `/extract-pitch` | Extract pitch from audio file |
| POST | `/pitch-correct` | Apply auto-tune to audio |
| POST | `/extract-melody` | Extract melody as MIDI notes |
| POST | `/karaoke-score` | Score karaoke performance |
| POST | `/detect-emotion` | Detect emotion from vocals |
| POST | `/classify-audio` | Classify audio type |

## Deploy to Railway

1. Create a new service in your Railway project
2. Point it to the `services/audio-analysis` directory
3. Railway will auto-detect the Dockerfile
4. Set the `PORT` env var (Railway does this automatically)
5. In your main app, set `AUDIO_ANALYSIS_API_URL` to the Railway internal URL:
   ```
   AUDIO_ANALYSIS_API_URL=http://audio-analysis.railway.internal:7871
   ```

## Local Development

```bash
cd services/audio-analysis
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
# Download RMVPE model
mkdir -p assets/rmvpe
wget -O assets/rmvpe/rmvpe.pt https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.pt
python app.py
```

## Notes

- Runs on CPU by default (no GPU required)
- CPU inference is slower (~5-15s per pitch extraction) but functional
- The RMVPE model (~80MB) is downloaded during Docker build
- Memory usage: ~500MB-1GB depending on audio length
