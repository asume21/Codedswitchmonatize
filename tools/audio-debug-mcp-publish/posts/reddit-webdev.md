# Reddit — r/webdev

**Title:**
I built an MCP server that gives AI coding assistants real-time perception of your running web app (audio, visuals, performance, network, security, console)

**Body:**
If you use an AI coding assistant (Claude Code, Cursor, Windsurf), you've probably hit this wall: your app is running in the browser, something is wrong, and your AI can only read your code. It can't actually see what's on screen, hear what's playing, measure the frame rate, or watch the network traffic.

I spent a long time on this problem while building a browser DAW. So I made **webear** — an MCP server that gives AI assistants real-time perception of your running app.

**What it captures:**

- **Audio (WebEar)** — capture what your Web Audio API context is outputting right now
- **Visual (WebEye)** — capture your canvas or video element
- **Performance (WebSense)** — FPS, JS heap, cumulative layout shift, audio latency
- **Network (WebNerve)** — API request timings, connection quality, storage usage
- **Security (WebShield)** — cookie scope, CSP headers, storage exposure, framing
- **Console (WebLog)** — uncaught exceptions, promise rejections, app state snapshot

Every system has three tools: capture, analyze, and diff (compare before/after a code change).

**Some tools that saved me real time:**

`mix_coach` — 5 second capture, returns structured mixing advice: is it clipping? is the low-end muddy? is the crest factor showing over-compression? Like having a mixing engineer inside your IDE.

`groove_score` — detects kick drum transients, measures timing against a 16th-note grid, returns swing factor and a consistency score. Tells you if the beat scheduler is drifting under load.

`diff_audio` — capture before your code change, capture after, get a full report of what changed. Caught a gain staging bug (peak went from -3.1 to -0.2 dBFS) before it hit prod.

`capture_telemetry` + `analyze_telemetry` — caught a memory leak from audio nodes not being disconnected. JS heap grew from 180MB to 310MB between two captures.

**Architecture:**
Express middleware + SSE bridge + browser client snippets. Each sensor (WebEar, WebEye, etc.) is a small client snippet that connects to the middleware and streams data back when the MCP server requests a capture. No microphone, no file exports, no screen sharing.

Works with Claude Code, Cursor, Windsurf, and any MCP-compatible IDE.

**npm:** `npm install webear`
**GitHub:** https://github.com/asume21/webear
**Free key:** codedswitch.com/developer (50 analyses/day, no credit card)

Happy to go deep on the architecture — the SSE-based browser bridge was the interesting part to build.
