# Product Hunt Launch

## Tagline (60 chars max)
Give your AI coding assistant full senses for your running app

## Short Description (260 chars max)
An MCP server that lets AI assistants (Claude Code, Cursor, Windsurf) capture and analyze your live web app in real-time. Audio, visuals, performance, network, security, and console — not files, not the microphone. Your app while it's running.

## Topics / Tags
- Developer Tools
- Artificial Intelligence
- Open Source
- Audio
- Web Development

---

## Full Description

**The problem every web developer hits with AI coding assistants:**

Your app is running. Something sounds wrong. Something looks wrong. The frame rate is tanking. An API call is slow. Your AI can only read your code — it can't actually perceive what your app is doing right now.

**webear fixes that.**

It's an MCP server that gives AI coding assistants real-time perception of a running web application through six sensor systems:

🎧 **WebEar — Audio**
Tap your Web Audio API context directly (before it hits the DAC). Clean digital signal, no room noise, no file export needed.
- Frequency band breakdown, RMS, peak, clipping detection
- BPM estimation, timing jitter
- `groove_score` — measures kick drum timing accuracy vs. a 16th-note grid, swing factor, consistency score
- `mix_coach` — structured mixing advice: loudness, dynamics, spectral balance, clipping
- `diff_audio` — compare audio before/after a code change

👁 **WebEye — Visuals**
Capture canvas or video elements. AI description of layout, animations, visual bugs. Before/after visual diffs.

📊 **WebSense — Performance**
FPS, JS heap memory, cumulative layout shift, audio context latency. Catch memory leaks and frame rate regressions.

🔌 **WebNerve — Network**
API request timings, connection quality, storage utilization. Find slow queries and bandwidth hogs.

🛡 **WebShield — Security**
Cookie scope, CSP headers, storage exposure, iframe framing. Security audit without leaving your IDE.

📋 **WebLog — Console**
Uncaught exceptions, promise rejections, warning patterns, app state snapshot. See what's failing in real-time.

**How it works:**
A small Express middleware mounts on your dev server. Each sensor is a browser snippet that connects via SSE and streams data when the MCP server requests a capture. Your IDE coordinates everything via the Model Context Protocol.

**Works with:** Claude Code, Cursor, Windsurf, and any MCP-compatible IDE.

**Free tier:** 50 analyses/day. No credit card required.

`npm install webear`

---

## Maker Comment (post this as first comment after launch)

Hey Product Hunt! 👋

I'm the developer behind webear. I built this while making a browser-based beat maker with Tone.js — I kept describing audio problems to my AI assistant and it had absolutely no way to know what I was talking about. That was the first frustration.

Then I realized the same blind spot shows up everywhere: visual glitches the AI can't see, memory leaks it can't measure, slow API calls it can't watch. The AI is flying blind while your app is running.

So I built a perception layer.

A few things I'm especially proud of:

**mix_coach** — this one blew my mind when it started working. You ask your AI to "coach the mix" and it captures 5 seconds, runs signal analysis, and gives you structured advice like a real mixing engineer: "your low-end is 47% of the mix, that's why it sounds muddy — high-pass the non-bass elements." That came from real conversations I wanted to have with my AI but couldn't.

**groove_score** — detects kick drum transients, aligns them to a 16th-note grid, and tells you swing factor and timing consistency. Incredibly useful for catching Tone.js scheduler drift before it ruins a beat.

**diff_audio** — I think of this as the unsung hero. Capture before a change, capture after, see exactly what shifted. Caught a gain staging bug before it shipped.

The architecture (Express middleware + SSE + browser snippets + MCP server) was the interesting engineering challenge — getting a clean real-time round trip from browser to IDE with no polling and no file I/O.

Get a free key at codedswitch.com/developer (50 analyses/day, truly no card needed).

Would love to hear what you build with it. What would you ask your AI if it could actually perceive your running app?
