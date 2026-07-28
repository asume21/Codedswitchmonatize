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

---

## Addendum 2026-07-28 — Phrase lock/evolve: the concrete mechanism

Resolves the open question "dial-in vs pad surface first" (answer: **phrase lock-loop +
variety first**) and specifies how "per-generator phrase locking" actually works. Traced
from code this session. Extends this spec; no new spec.

### The problem (from the user, by ear)

1. **Seams** — when a part loops, the wrap is audible; you can tell it's a loop.
2. **Middle ground** — want per-part control between "lock and repeat forever" and "keep
   evolving," not all-or-nothing.
3. **Sameness (regression)** — pick lo-fi → a beat; switch to trap; back to lo-fi → nearly
   the *same* beat. Every lo-fi sounds identical. "We can't have that."

### Root cause of the sameness (confirmed in code)

The band seeds RNG as `mulberry32(seed + getSessionSalt())`; `seed` is a deterministic hash
of style+section, and the song cell is a pure function of (style, section, salt).
`sessionSalt` re-rolls **only on organism start** (`GeneratorOrchestrator.ts:496` →
`rerollSessionSalt()`). So within a run, switching style and back rebuilds the identical cell
→ identical beat. The anti-drift discipline (one motif per section, no per-bar re-roll) and
the sameness are the same mechanism — cohesion bought determinism.

### The lock↔variety dial already exists

The seed/salt system *is* the control, just unexposed and mis-triggered:

- **Lock** = pin the seed (`setFreeplaySeed`) → reproducible, never drifts.
- **Fresh** = re-roll the salt (`rerollSessionSalt`) → new but still cohesive.
- **Evolve** = keep the committed motif, apply bounded variation (`varyMotif`).

The shared song cell keeps all five cohesive regardless of the above. So this is **wiring +
exposure, not a new engine** — which is why it belongs to *finishing* this spec.

### Control model: Lock / Evolve / Fresh — per-role AND global

Each of the 5 generators carries one state: **Lock**, **Evolve**, or **Fresh**. Global
controls set all five at once (Lock-all / Fresh-all); a per-role setting **overrides** the
global for that role (mixer solo/master model). State is owned by `GeneratorOrchestrator`
(single source), one field per role, mirrored in `OrganismCommandCenter`.

### How Lock produces a SEAMLESS loop (Approach A: commit-and-repeat)

On Lock, freeze the role's current 1–2 bar phrase as committed MIDI and replay that exact
phrase every cycle. Seamless because (a) identical notes each cycle and (b) note
releases/tails are handled at the wrap (no cut/click). This generalizes **Story Mode** (drum
groove lock) to all five roles and stays **live** — same instruments, still mixable, still
re-lockable. Rejected: deterministic re-generation (fragile); audio-bounce loop (that's
Phase 2).

### Variety fix (independent, ship FIRST)

Re-roll the salt at the right moments so returning to a style yields a fresh-but-cohesive
take, not a copy: on a **deliberate style change** and on an explicit **Fresh** action.
Never mid-locked-section (would break a Locked loop). This satisfies the audible-contract
rule for the Fresh/style controls and is the smallest highest-impact slice.

### Phase 2 — capture a Locked part to the loop library

A Locked role's phrase is a stable perfect loop → offer **Record** to bounce it
(`freezeBounce`) and save it as a clip. Requires the loop-pack **write path** — the loop-pack
system is read-only today (`server/routes/loops.ts` is all GET; packs are static JSON). Scope
as Phase 2; it reuses the Phase-1 Locked phrase directly. (See loop-pack spec.)

### Units / boundaries (for the plan)

- `freeplay/utils.ts` — salt-reroll triggers (variety fix).
- `GeneratorBase` + each generator — extend the existing per-role loop mode (`setLoopMode`,
  the `_loopMode` guards) to commit-and-repeat the committed phrase and honor Lock/Evolve/Fresh.
- `GeneratorOrchestrator` — owns per-role + global Lock/Evolve/Fresh state.
- `OrganismCommandCenter` — per-role + global control UI (extends existing controls; also
  closes the texture solo/mute parity gap found this session).
- Phase 2: loop-pack write path (`server/routes/loops.ts`) + `freezeBounce` wiring.

### Build order

1. **Variety fix** (salt reroll on style-change / Fresh) — kills the sameness, smallest slice.
2. **Per-role + global Lock/Evolve/Fresh state + UI** (built on existing loop mode).
3. **Seamless commit-and-repeat** for Lock (generalize Story Mode to all roles).
4. **Phase 2** — capture Locked part → loop library (needs the write path).
