# MCP Discord — #show-and-tell or #new-servers

**Message:**

Hey everyone 👋 I just published **webear** — an MCP server that gives AI assistants the ability to capture and analyze live audio from a running web application.

**What it does:**
- `capture_audio` — records what your Web Audio API context is outputting right now
- `analyze_audio` — returns RMS, peak dB, spectral centroid, frequency band breakdown, BPM, timing jitter, clipping
- `describe_audio` — plain-English AI description of the capture
- `diff_audio` — compares two captures and flags regressions

**Architecture:**
Express middleware + SSE bridge + browser client snippet. The AI taps the AudioContext output node directly — no microphone, no file export, clean digital signal.

**npm:** `npm install webear`
**GitHub:** https://github.com/asume21/webear

Works with Claude Code, Cursor, Windsurf, and any MCP-compatible IDE. Free tier available.

Built this because I kept telling my AI assistant "the bass sounds muddy" while building a music app and it had no way to hear anything 😅

Would love feedback on the architecture — happy to answer questions!
