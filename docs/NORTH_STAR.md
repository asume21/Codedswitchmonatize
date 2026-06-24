# CodedSwitch — Product North Star

> The single source of truth for what this app is FOR. Before building anything,
> check it against this doc. If a piece of work doesn't serve the goals below,
> it's probably a "double" — don't build it. This doc beats the README (which is
> marketing) and any feature spec (which is a detail).

---

## The one sentence

**CodedSwitch is a live AI beat-making instrument.** A performer hits go and the
**Organism makes and plays a professional, fire beat in real time** — something to
rap, sing, and perform over, live, in the moment.

It is **one instrument** (the Organism) with a workshop of supporting tools around
it — not a platform of 20 co-equal tools. That distinction is the whole strategy:
when the identity is "20 tools," every idea spawns another tool (the doubles).
When the identity is "one fire-beat instrument," every idea must justify how it
serves THAT — and most duplication dies on contact.

---

## The non-negotiable

The **Organism is the hook** — the first thing that draws users in. So it must
**WOW, completely.** That means:

- **Professional-level beats.** Not "pretty good for AI." Beats that sound like a
  real producer made them — composition, sound, and mix.
- **Real-time, live.** Generated and played in the moment, solid enough to perform
  over. No faltering, no waiting.

If the Organism doesn't make a first-time user stop and go "holy sh*t," nothing
else about the app matters yet. This is the bar. There is no way around it.

---

## Priority order (do NOT reorder)

### 1. Make the Organism flawless — FIRST, before anything else
Professional, real-time, live beats that wow. This is the entire game until it's
done. Every other feature waits.

### 2. Everything generated must be EDITABLE
When the Organism — or ANY generator (full-song, melody, drums, code-to-music,
any path) — makes music, it **writes that music into the editors** (piano roll,
beat grid, track store) so the user can refine it. Generation is a *starting
point*, never a dead end. A beat you can't open up and tweak is a demo, not a
tool.
*(Known gap: the Organism currently plays sound via its own Tone.js generators;
it likely does NOT yet write editable MIDI into the editors. Closing that is core,
not optional.)*

### 3. Then level up everything else — to the same bar
Once the Organism is flawless and editable, bring every supporting capability up
to professional quality, all of it editable:
- **Code-to-music** — better music output and better code analysis driving it.
- **Voice cloning** — quality and usability.
- **Track analysis** — analyzing uploaded/recorded audio.
- **Lyric page** — writing/editing flow.
- **Full-song generation** — and it, too, writes editable parts into the editors.

---

## What "fire / professional" means (the bar we measure against)

A beat is "fire" only when all three hold:
1. **Composition** — the groove, arrangement, and musical choices are genuinely
   good (the conductor/arrangement work).
2. **Sound** — the instruments and samples sound real and full, not thin GM
   soundfonts (the pro-instruments work).
3. **Mix** — it's balanced, punchy, and loud like a finished record (the mix-chain
   work).

All three must land. A great arrangement with thin sounds isn't fire; great sounds
with a weak arrangement isn't fire.

---

## How everything relates (one instrument, supporting cast)

- **Core — the Organism:** the live beat brain (composition) + its sound + its
  real-time playback. This is the product.
- **Editors (piano roll, beat maker, mixer):** where generated music becomes
  editable. The bridge between "AI made it" and "I shaped it."
- **Other generators (code-to-music, full-song, melody composer):** alternate
  ways IN — every one of them must produce editable output that lands in the
  editors.
- **Wrap-around tools (voice cloning, track analysis, lyrics, social, library):**
  serve the music and the performer; leveled up after the core.
- **Desktop hybrid (CodedSwitch:Astute):** a PROVEN-but-PARKED later layer for
  pro-grade / lower-latency / lossless output. It is NOT the path to a fire
  Organism beat right now (it routes the manual MIDI path, not the Organism, and
  its proof engine would currently downgrade the Organism's sound). Return to it
  only once the Organism is already fire and we specifically want to push output
  fidelity/latency further.

---

## How to use this doc (the anti-drift test)

Before starting any work, ask:
1. Does this make the **Organism's live beat more fire** (composition, sound, or
   mix)? → highest priority.
2. Does this make **generated music editable** in the editors? → core requirement.
3. Does this **level up a supporting tool** toward the professional bar? → only
   after the Organism is flawless.

If it does **none** of these, stop — it's almost certainly a double or a detour.

---

*Authored 2026-06-23 with the user (a freestyle performer). The Organism's
live-first, mic/voice-reactive design exists because the user performs live; this
doc encodes that the live fire beat is the product, not a feature.*
