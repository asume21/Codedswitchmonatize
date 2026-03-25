# audio-debug-mcp

**Give your AI coding assistant ears.**

An [MCP](https://modelcontextprotocol.io) server that lets AI coding assistants capture, analyze, and describe live audio from any web application. Works with **Windsurf**, **Cursor**, **Claude Code**, **VS Code + Copilot**, and any MCP-compatible IDE.

> *"The beat sounds muddy"* — now your AI can actually measure why and tell you the spectral centroid is at 600 Hz with 45% energy below 250 Hz.

---

## What It Does

| Tool | Description |
|------|-------------|
| `capture_audio` | Record a short clip (500ms–30s) of what your web app is outputting |
| `analyze_audio` | Signal analysis: RMS, peak dB, clipping, spectral centroid, frequency bands, BPM, timing jitter |
| `describe_audio` | Send the clip to Gemini or GPT-4o for a plain-English description |
| `diff_audio` | Compare two captures and flag what changed — loudness, tone, timing, clipping |

## How It Works

```
Browser (Web Audio API)
    ↓ MediaRecorder captures audio
    ↓ Uploads WebM blob via HTTP
Express Server (middleware)
    ↓ Stores captures in memory
    ↓ SSE dispatches capture commands
MCP Server (stdio)
    ↓ Retrieves + analyzes captures
AI Coding Assistant
    → "Your bass is clipping at -0.2 dBFS, spectral centroid is 580 Hz (muddy),
       and timing jitter is 23ms — the scheduler is drifting."
```

## Quick Start

### 1. Install

```bash
npm install audio-debug-mcp
```

### 2. Add the Express middleware to your dev server

```js
import express from 'express'
import { audioDebugMiddleware } from 'audio-debug-mcp/middleware'

const app = express()
app.use(express.json())

// Mount the audio debug bridge (dev only by default)
app.use('/api/audio-debug', audioDebugMiddleware())

app.listen(5000)
```

### 3. Add the client snippet to your web app

**Option A: Script tag**
```html
<script src="node_modules/audio-debug-mcp/client-snippet.js"></script>
<script>
  AudioDebugBridge.init()
</script>
```

**Option B: ES module import**
```js
import AudioDebugBridge from 'audio-debug-mcp/client'
AudioDebugBridge.init()
```

**Option C: With a specific AudioContext**
```js
const ctx = new AudioContext()
const masterGain = ctx.createGain()
masterGain.connect(ctx.destination)

AudioDebugBridge.init({
  audioContext: ctx,
  outputNode: masterGain,
})
```

**Option D: With Tone.js**
```js
import * as Tone from 'tone'
AudioDebugBridge.init({ toneJs: true })
```

### 4. Add the MCP server to your IDE

**Windsurf** (`mcp_config.json`):
```json
{
  "audio-debug": {
    "command": "node",
    "args": ["node_modules/audio-debug-mcp/dist/index.js"],
    "disabled": false,
    "env": {
      "AUDIO_DEBUG_BASE_URL": "http://localhost:5000"
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "audio-debug": {
      "command": "node",
      "args": ["node_modules/audio-debug-mcp/dist/index.js"],
      "env": {
        "AUDIO_DEBUG_BASE_URL": "http://localhost:5000"
      }
    }
  }
}
```

**Claude Code** (`.mcp.json`):
```json
{
  "mcpServers": {
    "audio-debug": {
      "command": "node",
      "args": ["node_modules/audio-debug-mcp/dist/index.js"],
      "env": {
        "AUDIO_DEBUG_BASE_URL": "http://localhost:5000"
      }
    }
  }
}
```

### 5. Start your dev server, open the app, play some audio, and ask your AI:

> "Capture 3 seconds of audio and tell me if the bass sounds muddy"

---

## Example Output

### `analyze_audio`

```
── Audio Analysis Report ──────────────────────────────
Duration:          3.02s

── Loudness ─────────────────────────────────────────
RMS:               -12.4 dBFS
Peak:              -1.2 dBFS
Dynamic range:     11.2 dB
Crest factor:      3.63
Clipping:          none

── Tone ──────────────────────────────────────────────
Spectral centroid: 2847 Hz
DC offset:         0.00012 (ok)

── Frequency Bands ───────────────────────────────────
Sub  (20-80 Hz):   8.2%
Bass (80-250 Hz):  22.1%
Mid  (250-2k Hz):  38.4%
Hi-mid (2-6k Hz):  21.8%
High (6k+ Hz):     9.5%

── Rhythm ────────────────────────────────────────────
Estimated BPM:     92
Onset count:       12
Timing jitter:     4.2 ms std dev

── Summary ───────────────────────────────────────────
Loudness: -12.4 dBFS RMS, peak -1.2 dBFS. Tone: balanced (centroid 2847 Hz).
Band mix — sub: 8% | bass: 22% | mid: 38% | hi-mid: 22% | high: 10%.
Rhythm: estimated 92 BPM, 12 onsets detected. Timing: very tight (< 5 ms jitter).
```

### `diff_audio`

```
── Audio Diff: a1b2c3d4… → e5f6g7h8… ──

── Loudness ──────────────────────────────────────────
  RMS: -14.2 dBFS → -12.4 dBFS  (+1.8 dBFS)
⚠ Peak: -3.1 dBFS → -0.2 dBFS  (+2.9 dBFS)
⚠ CLIPPING INTRODUCED — gain staging regression

── Tone ──────────────────────────────────────────────
⚠ Spectral centroid: 2847.0 Hz → 1920.0 Hz  (-927.0 Hz)

── Interpretation ────────────────────────────────────
A gain bug was introduced that causes clipping.
Tonal character changed noticeably — EQ or filter behaviour may have shifted.
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUDIO_DEBUG_BASE_URL` | `http://localhost:4000` | URL of your dev server (where middleware is mounted) |
| `GEMINI_API_KEY` | — | Google Gemini API key (for `describe_audio` tool) |
| `OPENAI_API_KEY` | — | OpenAI API key (fallback for `describe_audio` tool) |

### Middleware Options

```js
audioDebugMiddleware({
  maxCaptures: 50,       // Max captures in memory (default: 50)
  maxAgeMins: 10,        // Auto-evict after N minutes (default: 10)
  maxUploadBytes: 50e6,  // Max upload size (default: 50MB)
  devOnly: true,         // Disable in production (default: true)
})
```

### Client Options

```js
AudioDebugBridge.init({
  audioContext: myCtx,        // Provide your own AudioContext
  outputNode: myGainNode,     // The audio node to tap
  toneJs: true,               // Auto-detect Tone.js
  bridgeBase: '/api/audio-debug',  // Override API path
  devOnly: true,              // Only init in dev mode (default: true)
})
```

---

## Requirements

- **Node.js** >= 18
- **ffmpeg** on PATH (for `analyze_audio` and `diff_audio` — decodes WebM to PCM)
- A browser that supports `MediaRecorder` (Chrome, Firefox, Edge, Safari 14+)

## Who Is This For?

- **Music app developers** — debug beats, synths, effects, and mixing in real-time
- **Game audio developers** — verify sound effects, spatial audio, and mixing
- **Audio tool builders** — test Web Audio API pipelines without leaving your IDE
- **Podcast/streaming apps** — check audio quality, levels, and encoding
- **Anyone using Web Audio API** — if your app makes sound, your AI can now hear it

## License

MIT — see [LICENSE](./LICENSE)

## Author

Built by [@asume21](https://github.com/asume21)
