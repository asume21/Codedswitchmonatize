# Hacker News — Show HN

**Title:**
Show HN: webear – Give your AI coding assistant ears (Web Audio API → MCP)

**Body:**
I built an MCP server that lets AI coding assistants (Claude Code, Cursor, Windsurf) capture and analyze live audio from a running web application.

The problem: I'm building a music production app with Tone.js and kept telling my AI "the bass sounds muddy." It couldn't hear anything — it could only read code. So I built a bridge.

How it works:
- A tiny Express middleware mounts on your dev server
- A client snippet taps your Web Audio API `AudioContext` output node
- When you ask your AI to capture audio, it POSTs the SSE command to the browser
- The browser records with MediaRecorder and uploads the WebM blob back
- The MCP server fetches it and sends it to the analysis API

The AI gets back: RMS, peak dB, spectral centroid, frequency band energy (sub/bass/mid/hi-mid/high), estimated BPM, timing jitter, and clipping detection. There's also a `diff_audio` tool for comparing before/after a code change.

The key distinction from other audio MCPs: this taps the Web Audio graph *before* it hits the DAC, so you get a clean digital signal — no room noise, no microphone, no file export needed.

GitHub: https://github.com/asume21/webear
npm: https://www.npmjs.com/package/webear

Free tier available (50 analyses/day). Would love feedback on the architecture and use cases I'm missing.
