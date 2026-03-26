# Reddit — r/WeAreTheMusicMakers + r/edmproduction

**Title:**
I made a tool so AI coding assistants can actually hear your Web Audio app while you're building it

**Body:**
I'm building a browser-based DAW / beat maker with Tone.js. For months I kept typing things like "the kick sounds too boomy" or "there's some weird distortion in the high end" to my AI coding assistant — and it had zero idea what I was talking about because it can only read code.

So I built **webear** — an MCP server that gives AI assistants like Claude Code and Cursor the ability to actually capture and analyze your app's audio output in real-time while you're developing.

You just ask:
> "Capture 3 seconds and tell me why the bass sounds muddy"

And it tells you:
> "Bass band is 41% of the mix (high), spectral centroid is 580 Hz, which indicates low-mid buildup. Try a high-pass filter on the bass synth around 120 Hz."

**What it measures:**
- Frequency band breakdown (sub / bass / mid / hi-mid / high as % of mix)
- RMS and peak levels + clipping detection
- Spectral centroid (tells you if things are muddy vs. bright)
- Estimated BPM and timing jitter (great for catching scheduler drift)
- Before/after comparison when you change code

**Use cases I've found so far:**
- Debugging why a synth sounds wrong
- Catching gain staging issues (clipping) between commits
- Verifying EQ/filter changes actually did what you intended
- Making sure timing stays tight as the session gets heavier

Not a DAW plugin — this is specifically for developers building audio apps. But if you're making something in the browser with Tone.js or raw Web Audio API, this might save you a lot of "why does this sound like that" time.

npm: `npm install webear`
GitHub: https://github.com/asume21/webear
