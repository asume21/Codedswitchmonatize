# Twitter / X Thread

**Tweet 1 (hook):**
I built an MCP server that gives AI coding assistants ears 🎧

You can now ask Claude/Cursor/Windsurf to capture and analyze live audio from your running web app.

No microphone. No file exports. Direct tap on the Web Audio API.

npm install webear

🧵

---

**Tweet 2 (the problem):**
The problem I was solving:

I'm building a browser DAW with Tone.js. I kept telling my AI "the bass sounds muddy" and it had NO idea what I meant — it can only read code.

There was no way for it to actually hear what my app was outputting.

---

**Tweet 3 (the solution):**
So I built a bridge:

• Express middleware mounts on your dev server
• Client snippet taps your AudioContext output node
• MCP server coordinates between IDE and browser via SSE
• AI gets back: RMS, peak dB, frequency bands, BPM, timing jitter, clipping

---

**Tweet 4 (the demo — replace with GIF):**
[INSERT DEMO GIF HERE]

Ask: "capture 3s and tell me why the bass sounds muddy"

AI response: "Bass band is 41% of mix, spectral centroid 580 Hz — low-mid buildup. High-pass the bass synth around 120 Hz."

---

**Tweet 5 (the diff tool):**
My favorite feature: diff_audio

Capture before your code change. Capture after. Ask your AI what changed.

It'll tell you if you introduced clipping, shifted the tonal character, or messed up the timing.

Like git diff but for sound.

---

**Tweet 6 (why it's different):**
Every other audio MCP either:
- Analyzes a file on disk
- Turns on your physical microphone (room noise 🙈)

This one reads from the AudioContext BEFORE it hits the DAC.

Clean digital signal. Zero room noise. No file export.

---

**Tweet 7 (CTA):**
Free tier: 50 analyses/day

Works with Claude Code, Cursor, Windsurf, and any MCP-compatible IDE

GitHub: github.com/asume21/webear
npm: npmjs.com/package/webear

Would love to hear what you build with it 👇
