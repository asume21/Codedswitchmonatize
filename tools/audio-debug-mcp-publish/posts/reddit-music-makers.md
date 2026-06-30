# Reddit — r/WeAreTheMusicMakers + r/edmproduction

**Title:**
I made a tool so your AI coding assistant can actually hear your beat and coach your mix while you're building it

**Body:**
I'm building a browser DAW with Tone.js. For months I kept typing things like "the kick sounds too boomy" or "there's clipping in the master" to my AI coding assistant — and it had zero idea what I was talking about because it can only read code.

So I built **webear** — an MCP server that gives AI assistants like Claude Code and Cursor the ability to actually capture and analyze your app's audio output in real time while you're developing.

**The two tools that changed how I work:**

**mix_coach** — ask your AI "coach me on this mix" and it captures 5 seconds and gives you structured feedback:

> ⚠ **Heavy low-end.** Sub+bass is 47% of your spectral energy. High-pass non-bass elements around 120 Hz.
> ✓ **Safe headroom.** Peak at -2.1 dBFS, no clipping.
> ✓ **Healthy dynamics.** Crest factor 2.8 — good transient punch without over-compression.
> ⚠ **Dull high end.** Only 8% energy above 6kHz. Try a gentle high-shelf boost at 10kHz.

Like having a mixing engineer watching your code live.

**groove_score** — detects kick drum transients, aligns them to a 16th-note grid, and tells you:
- Average deviation from the beat (in milliseconds)
- Swing factor (50% = straight, 66% = MPC triplet shuffle)
- Consistency score
- Hit-by-hit table: which kicks were early, on time, or late

Invaluable for debugging Tone.js scheduler drift when the session gets heavy.

**Also in there:**
- `analyze_audio` — full frequency breakdown, BPM estimation, timing jitter
- `diff_audio` — git diff for sound. Compare before/after a code change and see exactly what shifted
- `describe_audio` — plain-English AI description: "boom bap beat, punchy kick with sub around 60Hz, snappy snare, dusty hi-hats"

This is specifically for developers building audio apps in the browser — not a DAW plugin, not for producers working in Ableton. But if you're making a beat maker, synth, DAW, or anything Web Audio in the browser, this'll save you a lot of "why does this sound like that" time.

**What it measures:**
- Frequency band breakdown (sub / bass / mid / hi-mid / high as % of mix)
- RMS and peak levels + clipping detection
- Spectral centroid (muddy vs. bright)
- Dynamic range + crest factor (over-compressed vs. punchy)
- Estimated BPM and timing jitter
- Kick groove analysis vs. 16th-note grid

npm: `npm install webear`
GitHub: https://github.com/asume21/webear
Get a free key: codedswitch.com/developer
