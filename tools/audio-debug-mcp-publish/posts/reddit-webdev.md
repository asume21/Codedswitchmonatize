# Reddit — r/webdev

**Title:**
I built an MCP server that gives AI coding assistants the ability to hear your web app's audio output in real-time

**Body:**
If you're building anything with the Web Audio API and using an AI coding assistant (Claude Code, Cursor, Windsurf), you've probably hit this wall: you describe a problem like "the bass sounds muddy" or "there's clipping somewhere" and the AI is completely blind — it can only read your code.

I spent weeks on this exact problem while building a music production app. So I made **webear**.

**What it does:**

- `capture_audio` — tells the browser to record N milliseconds of what your Web Audio `AudioContext` is actually outputting
- `analyze_audio` — returns RMS, peak dB, spectral centroid, frequency band energy breakdown, estimated BPM, and timing jitter
- `describe_audio` — asks an AI model to describe the sound in plain English
- `diff_audio` — compares two captures and flags what changed (great for catching audio regressions between commits)

**The architecture:**

It's an Express middleware + SSE bridge + browser client snippet. The middleware mounts on your dev server, the client taps your audio output node, and the MCP server coordinates between your IDE and the browser. No microphone needed — it reads the digital signal directly from the Web Audio graph.

**Why this is different from other audio MCPs:**

Every other audio MCP I found either analyzes an existing file on disk or turns on the physical microphone. This one reads from the `AudioContext` itself, so you get zero room noise and no need to export files.

**npm:** `npm install webear`
**GitHub:** https://github.com/asume21/webear

Free tier: 50 analyses/day. Would love to hear if anyone has use cases beyond music apps — game audio, podcast tools, streaming apps, anything that uses Web Audio.
