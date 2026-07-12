# The Organism as a Playable Instrument — Design

**Date:** 2026-07-11
**Status:** Draft for review. Consolidates a long brainstorming thread. This is the
**product umbrella**; it references and extends existing specs rather than
replacing them (loop-pack, freeplay-generators, conductor, technique/articulation).
Do NOT fork those — extend.

## Core principle

The Organism is a **generative instrument the user plays** — not an AI that decides
the beat. The generators produce good musical material (quality is the floor, not
optional); the **user dials controls to sculpt the sound they hear in their head.**
The player decides the sound; the AI supplies the instrument. This is the identity
that draws musicians who reject "press one button, replace the artist" AI.

Corollary that reframes all prior tuning frustration: every musical decision
currently hard-coded in the engine (swing, hat density, low-mid balance,
drum-vs-bass level, energy/density, keys-vs-pads) is a **control that belongs in the
user's hands.** Tonight those were tuned by reaching into code — proof they should
be surfaced. There is no single "fire" setting to find; fire is what the player
dials.

## Two control layers

### 1. Dial-in controls (tone shaping)

Per generator, plus global. Named musically, not technically. Each maps to existing
generator/mix parameters underneath.

- **Drums** — kit/sound, pattern feel, speed/half-time, density.
- **Bass** — long sustained lines ↔ short hits/stabs; 808 vs sub; slides on/off; sub weight.
- **Harmony** — keys ↔ pads (instrument); dark ↔ bright voicing; sparse ↔ full.
- **Lead** — instrument (guitar/violin/flute/…); phrase length; activity; register; repetition.
- **Texture** — warm ↔ dark; motion; amount (incl. off).
- **Global** — swing, darkness, drum-forward, **improvisation-freedom** (exact ↔ wild).

### 2. Performance surface (Groove-Pad-style pads)

The big playable gestures. 24 pads/side, A/B = 48 per **Performance Pack**. Each pad
is an *audible committed behavior* (a loop, a generated musician, a phrase, a scene,
or a one-shot), all phase-locked to the one master transport, with rings showing
shared bar position and queued → active → developing states. Packs are curated for
compatibility (same BPM/key/phase, safe transitions). See the loop-pack spec's
"Live Band + Loops Hybrid" section — this is that hybrid realized as a play surface.

## The cohesion mechanism: phrase lock-and-loop

The "mess" comes from generators improvising freely — patterns that never repeat, so
nothing locks. **The cure is user-driven: lock a good phrase and loop it, Groove-Pad
style, so it becomes a stable repeating part** while other roles keep evolving.
Everything stays phase-locked to the single shared transport.

**This is partly SHIPPED: Freeze Mode** (freeze the live groove and loop it; the
melody evolves on top). This spec generalizes freeze to **per-generator phrase
locking** and wires it to the pad surface. Cohesion becomes a control the player
triggers, not a quality the engine must luckily produce.

## Grounded in existing systems (extend, do not duplicate)

- **One shared clock** — `TransportContext` owns the single `Tone.Transport`; every
  generator and loop clip is already phase-locked. The pad rings just *visualize* it.
- **5 generators + technique/articulation controls** — the seed of the dial-in
  surface already exists in `OrganismCommandCenter`.
- **Freeze Mode** — the phrase lock/loop seed (shipped).
- **Loop-pack system** — BPM/key sync, scenes, `setLoopMute`, role ceilings,
  compatibility. Performance Packs extend this.
- **Conductor** — remains the entity that keeps directed choices cohesive.

## The audible-contract rule (non-negotiable)

Every control and every pad MUST produce a perceptible musical change within its
stated boundary — never a silent settings toggle. If a generated variation is too
similar to be heard, the engine exaggerates or re-rolls it before committing. A
control that does nothing audible is a bug.

## Sequencing

Controls only feel good if each setting yields good music, so build incrementally,
audible-contract-first. Start with the highest-leverage dial-in controls — the exact
ones hand-tuned tonight (drum-forward, swing, density, keys-vs-pads, bass
lines-vs-hits) plus **phrase lock-loop** — because they convert tonight's frustration
directly into shipped features and prove the model before the full 48-pad surface.

## Open questions (for the user)

- The first control set + exact pad layout for pack #1.
- How much each generator auto-decides vs the user must set (the "freedom" dial's default).
- Whether dial-in controls or the pad surface is the foundation to build first.
