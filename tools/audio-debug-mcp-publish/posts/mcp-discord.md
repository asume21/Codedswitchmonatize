# MCP Discord — #show-and-tell or #new-servers

**Message:**

Hey everyone 👋 I just published **webear** — an MCP server that gives AI assistants real-time perception of a running web application. Not file analysis, not the microphone — live signals from the browser itself.

**Six perception systems, 20+ tools:**

🎧 **WebEar** (audio)
- `capture_audio` — records live Web Audio API output
- `analyze_audio` — RMS, peak, clipping, frequency bands, BPM, timing jitter
- `describe_audio` — plain-English AI description
- `diff_audio` — before/after audio comparison
- `groove_score` — kick timing accuracy vs. 16th-note grid, swing factor, consistency score
- `capture_and_analyze` — one-shot capture + analysis
- `mix_coach` — structured mixing feedback (loudness, dynamics, spectral balance, clipping)

👁 **WebEye** (visual)
- `capture_video` — captures canvas/video elements
- `describe_video` — AI visual description
- `diff_visuals` — compare two visual states

📊 **WebSense** (performance)
- `capture_telemetry` / `analyze_telemetry` — FPS, JS heap, CLS, audio latency

🔌 **WebNerve** (network)
- `capture_nerve` / `analyze_nerve` / `diff_nerve` — API timings, connection quality

🛡 **WebShield** (security)
- `capture_shield` / `analyze_shield` — cookie scope, CSP, storage exposure

📋 **WebLog** (console)
- `capture_logs` / `analyze_logs` — exceptions, rejections, app state

**Architecture:** Express middleware + SSE bridge + browser snippets per sensor. Captures are free; analysis costs credits (1–3 per call). Free tier: 50 analyses/day.

**npm:** `npm install webear`
**GitHub:** https://github.com/asume21/webear
**Key signup:** codedswitch.com/developer

Works with Claude Code, Cursor, Windsurf, and any MCP-compatible IDE. Built because I kept telling my AI "the bass sounds muddy" while building a beat maker and it had no way to hear anything 😅

Happy to answer architecture questions!
