# Hacker News — Show HN

**Title:**
Show HN: webear – Give your AI coding assistant real-time perception of your running web app

**Body:**
I built an MCP server that lets AI coding assistants (Claude Code, Cursor, Windsurf) perceive what's happening inside a running web application in real time — not by reading code, but by actually capturing live signals from the browser.

**The problem:**
I'm building a browser DAW with Tone.js. I kept telling my AI "the bass sounds muddy" and it had no way to know what I meant — it can only read code. Same problem kept appearing for visual bugs, memory leaks, and slow API calls. The AI is completely blind while your app is running.

**What I built:**
A perception layer that bridges your running browser tab to your IDE via an Express middleware + SSE + MCP server. Six capture systems:

- **WebEar** — audio: RMS, peak, clipping, frequency bands, BPM, timing jitter, groove score, mix coaching
- **WebEye** — canvas/video: AI visual description, before/after visual diffs
- **WebSense** — performance telemetry: FPS, JS heap, layout shift (CLS), audio latency
- **WebNerve** — network: API request timings, connection quality, storage utilization
- **WebShield** — security: cookie scope, CSP headers, storage exposure, framing
- **WebLog** — console: uncaught exceptions, promise rejections, app state snapshot

Each system has capture → analyze → diff tools. Captures are free; analysis costs credits.

**A few tools I'm proud of:**

`mix_coach` — captures 5 seconds and gives structured mixing feedback: loudness headroom, clipping status, dynamic punch (crest factor), spectral balance coaching, DC offset. Like a virtual mixing engineer inside your IDE.

`groove_score` — detects kick drum transients, aligns them to a 16th-note grid, and reports average timing deviation, swing factor, and a consistency score. Tells you if your beat is "In the Pocket" or "Loose/Laidback" with a hit-by-hit table.

`diff_audio` — compare two audio captures and get a full diff: loudness delta, tonal shift, clipping introduced/resolved, timing changes. Like `git diff` for sound.

**The key distinction:** This reads from the Web Audio `AudioContext` *before* it hits the DAC — clean digital signal, no room noise, no file export needed. WebEye reads from canvas/video elements. None of it touches the microphone or the filesystem.

**Setup is ~5 minutes:**
1. `npm install webear`
2. Mount `webearMiddleware()` in Express
3. Drop `WebEar.init()` in your client
4. Add the MCP server config to your IDE
5. Get a free key at codedswitch.com/developer (50 analyses/day free tier)

GitHub: https://github.com/asume21/webear
npm: https://www.npmjs.com/package/webear

Would love feedback on the architecture and use cases I haven't thought of — game audio, WebGL, streaming apps, anything with a Web Audio graph or canvas.
