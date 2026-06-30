# Twitter / X Thread

**Tweet 1 (hook):**
I gave my AI coding assistant full senses for my running web app.

It can now hear the audio, see the canvas, feel the FPS, diagnose the network, audit the security, and read the console — all live, without touching a file.

npm install webear

🧵

---

**Tweet 2 (the problem):**
The problem I kept hitting:

I'm building a browser DAW with Tone.js. I'd tell my AI "the bass sounds muddy" — it had NO idea what I meant. It can only read code.

Same story for visual bugs, memory leaks, slow API calls. The AI is flying blind while your app is running.

---

**Tweet 3 (the solution):**
So I built a perception layer for the browser.

One npm package. One snippet. Your AI can now capture and analyze your live app across 6 dimensions:

• WebEar — audio
• WebEye — canvas/video
• WebSense — FPS, memory, layout shift
• WebNerve — API timing, network
• WebShield — cookies, CSP, security
• WebLog — console output, exceptions

---

**Tweet 4 (mix_coach demo — replace with GIF):**
[INSERT DEMO GIF HERE]

Ask: "coach me on this mix"

AI response:
> ⚠ Heavy low-end — sub+bass is 47% of mix, eating your headroom.
> ✓ No clipping. Peak at -2.1 dBFS.
> ⚠ Muddy — spectral centroid 580 Hz. High-pass non-bass elements at 120 Hz.
> ✓ Groove: 8.3ms avg deviation. In the pocket.

---

**Tweet 5 (groove_score):**
My favorite tool: groove_score

It detects kick drum transients, aligns them to a 16th-note grid, and tells you:
- Average deviation from the beat (ms)
- Swing factor %
- Tightness consistency score
- Hit-by-hit table: early / on-time / late

"In the Pocket (Super Tight)" hits different from your AI.

---

**Tweet 6 (diff_audio):**
diff_audio is git diff for sound.

Capture before your code change. Capture after. Ask your AI what changed.

It'll tell you if you introduced clipping, shifted the tonal character, or messed up the timing.

Caught a gain bug before it hit prod. The peak went from -3.1 to -0.2 dBFS.

---

**Tweet 7 (beyond audio — the full suite):**
And it goes way beyond audio.

capture_telemetry → analyze frame rate, JS heap, layout shift, audio latency
capture_nerve → diagnose slow API calls, network quality
capture_shield → audit cookie scope, CSP headers, storage exposure
capture_logs → catch uncaught exceptions and warnings

All from your running app. No file exports. No microphone.

---

**Tweet 8 (architecture):**
Architecture:

• Express middleware mounts on your dev server
• Each client snippet (WebEar/WebEye/etc.) connects via SSE
• MCP server coordinates between your IDE and the browser
• Clean digital signal — no room noise, no file export

Works with Claude Code, Cursor, Windsurf, any MCP-compatible IDE.

---

**Tweet 9 (CTA):**
Free tier: 50 analyses/day. No credit card.

npm install webear
GitHub: github.com/asume21/webear
Get a key: codedswitch.com/developer

What would you ask your AI if it could actually perceive your running app? 👇
