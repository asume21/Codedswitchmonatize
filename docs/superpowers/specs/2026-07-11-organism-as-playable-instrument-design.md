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

---

## Requested 2026-08-05 — two asks from the user (captured, not yet designed)

### A. Soloed means SOLOING, and two players trading

> "I still want the chords and melody to be able to play full solos when they are
> soloed, not just what they play as a band … it would be cool if I could have the
> melody and chords both playing the guitar, or not the guitar and one the flute,
> and have them both play off each other and make awesome music — or by themselves"

Two distinct things:

1. **Solo = a real solo.** Today the solo button is a MIX action (mute everyone
   else); the soloed generator keeps playing its band part. He wants soloing to
   change what the player PLAYS — a full statement, not the supporting part.
2. **Two players trading.** Melody and chords on freely-chosen instruments,
   answering each other.

**⚠️ Tension with a previous decision — do not overturn silently.** The user
earlier settled that solo mode is "a locked riff to rap over, not virtuoso
shredding" (machine-gun trill bug, `fa849f08`; "audition must equal
performance"). This ask points the other way. Reconcile explicitly: likely
answer is that FREESTYLE mode keeps the locked riff (it is the bed he raps over)
and an explicit SOLO/showcase mode is where a player states a full solo — two
modes, not one behaviour redefined.

**Already exists — extend, do not rebuild:**
- Instrumental duet: `GeneratorOrchestrator.maybeAnswerMelodyRest` / `executeDuetCue`
  watches the melody's rests and cues a chord answer.
- `call-response` comp gesture in `ChordImproviser` (answers in the back half).
- Per-role instrument assignment: `InstrumentPerformerRouter` + the Chords/Bass/
  Melody instrument dropdowns (Nylon Guitar, Violin, Trumpet, Cello…).
- Role system (`lead` / `support` / `out`) from the Conductor spec.

The missing piece is not machinery, it is INTENT: nothing decides "you are
soloing now, play a statement" or "you two are trading fours".

### B. Texture needs controls and a voice picker

> "texture needs some controls and instead of it just being a background sound —
> which I like — it would be nice to actually have some keys and pads to choose
> from like we have the instruments on chords and melody"

`TextureGenerator` already carries a pad voice per mode (`TEXTURE_VOICE_BY_MODE`,
`swapPadVoice`, `createPadSamplerForMode`, `refreshVoice`) — currently
VSCO2_StringSection. There is no UI, so it reads as a fixed wash rather than a
chosen instrument. Mostly a UI-exposure + setter task, matching the existing
Chords/Melody instrument dropdowns.

Note the constraint discovered 2026-08-05: texture was the render-thread hog (two
ConvolverNodes; `c5462a5e`). Any new pad voice must be measured with
`__audioHealth()` before it ships — a lush new pad is exactly how the crackle
comes back.

#### A.1 — the two modes, decided by the user 2026-08-06 (build LATER)

Soloing an instrument offers a choice of two behaviours. This resolves the
tension flagged above — the locked riff is not replaced, it becomes one of two
explicit modes:

1. **"Make a perfect loop bed"** — the soloed player writes a loop the BEAT can
   be built on and that it can then solo over. This is the existing
   "locked riff to rap over" behaviour, made explicit.
2. **"Play me a full song"** — the soloed player performs a complete piece
   rather than a loop.

Deferred by the user: "that can wait for now, I just want to get all five
generators playing their part of a beat first."

#### A.2 — Beat Mode, the BAND-level loop bed (SHIPPED 2026-08-08)

A.1 above is per-instrument. The user asked for the same idea at band scale:
"there is a song mode but maybe we should also have a beat mode."

**Investigation first — most of it already existed.** The rhythm section is
already a locked 4-bar core tiled across a section with a turnaround on its
final bar (`DrumImproviser.buildFreeplaySectionDrumHits`); sections already
exist; per-section multipliers are constants that do not move mid-section; and
drums/bass/chords already play turnarounds. So Song Mode is *already* "~6
sections, each a locked loop, with the change announced." A separate Beat Mode
that re-implemented any of that would have been a duplicate system.

**What was actually missing** is that a section change is expressed by moving
the ground: the arc ducks the rhythm section, thins the drum pattern (below
0.45 density the filter keeps kick+snare and drops EVERY hat), and a breakdown
"genuinely kills the drums" by design. Defensible on a produced record;
hostile to a live freestyle take. The user's report: Song Mode on is
"a difference but not a better difference."

**Decision — announce and hold, not duck and thin.** Beat Mode keeps the whole
arrangement running: sections, per-section harmony (musicMind's matrix in plan
mode), turnarounds, and the pre-drop break are all untouched — a one-bar break
IS the announcement the user wants. It only pins the FOUNDATION: drums and bass
ignore the section multiplier (including a dropout's 0) and the drum density
ladder. Melody/chords/texture keep following the section, so a drop still feels
like a drop.

Implementation: `client/src/organism/generators/beatMode.ts` — a pure intent
module in the same shape as `featuredPerformance.ts`, resolved at the single
choke point (`GeneratorOrchestrator.applyArrangement`). No second scheduler, no
new arrangement system.

**Deliberately NOT coupled to Song Mode in either direction.** The
Feature/Song-Mode pair (each forcing the other) proved that two flags which
force each other cannot be reasoned about — it is why no capture ever recorded
`featured: true`. With the arrangement off, Beat Mode is simply inert; jam mode
and Loops Mode are unchanged, per the user's explicit instruction.

Related fix found during the same investigation: `setArrangementEnabled(false)`
restored the drum gain but not the drum *density*, stranding the thinning so
jam mode inherited a kick+snare skeleton from the last sparse section forever
(captured live as `arr:1` / `sectionDensity:0.30`, 96 raw hits → 31 events).
That is the "drums are very sparse" report, and it is fixed independently.

#### A.3 — Beat Mode IS the beat machine (designed 2026-08-17, supersedes parts of A.2)

**The report that opened this.** "When I enable it I hear nothing change at all.
It's not like I start it and the generators start producing fixed loops that fit
together." Both halves of that are accurate, and both were by design:

1. With Song Mode OFF, Beat Mode executes **zero lines** — `beatModeMultiplier`
   and `beatModeDrumDensity` are called at `GeneratorOrchestrator:2441-2448`,
   below the `if (!this.arrangementEnabled) return` early-exit at 2252.
2. With Song Mode ON it is a **negative** feature — it only *prevents* the duck,
   the thinning and the breakdown. Toggled mid-verse there is nothing yet to
   prevent, so nothing changes for what can be minutes.

A.2 was built on the premise that Song Mode was already "~6 sections, each a
locked loop." The 2026-08-17 debugging session found that premise was partly
false: bass and chords seeded from the section NAME alone, so they replayed one
identical 4-bar phrase for a whole 16-bar section and the entire form rewound
note-for-note on the wrap; `cypher-flow` never fired a section change at all.
Those are fixed separately. A.3 is what Beat Mode itself becomes.

**Decisions the user revised in this session — these override A.2:**

- A.2: "with the arrangement off, Beat Mode is simply inert." **Now: with the
  arrangement off, Beat Mode is the whole feature.** It stops being a modifier
  of Song Mode and becomes the beat machine in its own right.
- `introBuild.ts`: "aim for the middle of the user's 10-15s window." **Retired.**
  The user's revision, verbatim: "it doesn't matter exactly when they all come
  in, what matters is that it comes in where it fits — if that takes 100min or
  if that takes 10 secs, as long as it sounds good it's fine." `TARGET_BUILD_
  SECONDS` and the tempo term go away.
- A first draft of A.3 replaced the seconds target with a CHORD-boundary rule.
  **Also wrong**, and the user's next answer is the one that matters: "the way I
  think of it in my head is how I play groove pads. I start one of the pads and
  it starts looping, I usually let it play one or two rounds then bring in
  something else." The unit is neither seconds nor chords. It is the **ROUND** —
  the loop's own cycle. See below.

##### The model: a loop launcher, not an arrangement

Beat Mode is a groove-pad performance. The user's own description is the spec:

> "I start one of the pads and it starts looping. I usually let it play one or
> two rounds then bring in something else, and then after I have everything in I
> let it play for a bit, then I might drop something or start and stop something
> quickly or go back and forth between two — but I can hear the beat and know
> when to do it."

Three consequences, and each kills an assumption an earlier draft made:

1. **The unit of time is the ROUND**, not the bar, the second, or the chord. A
   round is however long the playing loop takes to come back around — already a
   quantity the engine knows (`DRUM_CORE_BARS = 4`). It is tempo-independent and
   harmony-independent by construction, which is why a launcher never lands
   wrong. Entries are "one or two rounds," not "10-15 seconds" and not "on the
   chord change."
2. **Mid-chord entries are NORMAL, not an exception to be avoided.** Entries a
   round apart do not align to a 4-chord harmonic cycle, so parts routinely
   arrive mid-chord. That is the user's correction ("I don't know if I would say
   never mid-chord") and it is the *consequence* of the launcher model, not a
   separate note. Entry rules therefore shape HOW a part lands, never WHEN it is
   allowed to.
3. **There are two phases, not one.** BUILD (parts arrive until all five are in)
   and PERFORM (ride, then drop a part, stop-start one quickly, trade between
   two). The second is not a variant advance on a timer — it is a vocabulary of
   MOVES. An earlier draft of this section proposed advancing a variant every N
   trips around the progression (~86s); that is a scheduled change, which is the
   clock-driven rotation the user has rejected before. Removed.

##### Control model — the user plays first, the Organism learns after

Decided by the user: **both**, built user-first.

Beat Mode gives the user the pads: five parts he can drop and bring back, on the
beat, quantised to the round so a move cannot land wrong. The Organism holds the
loop, the harmony and the cohesion; the performance is his. Once a move can be
TRIGGERED and heard, the Organism can be taught to reach for it on its own, and
any move the user makes takes over.

The reason for this order is the reason A-then-B was chosen for entries: the
moves are identical either way, and the hard part is not performing a drop — it
is knowing WHEN, which is exactly the judgement the user described as "I can
hear the beat and know when to do it." Encoding that judgement before either of
us has heard the moves in isolation would be invention. Make it playable, hear
which moves are good, then teach the timing.

Note the standing constraint this must respect: the user is freestyling while
this plays. Hands-busy is a real cost, and it is the argument for the Organism
eventually taking over — not for skipping the playable stage.

##### The move vocabulary (phase 2 — playable first)

From the user's description, three moves, all quantised to the round:

- **Drop** — take a part out; bring it back.
- **Stop-start** — remove and return a part quickly, inside a round.
- **Trade** — alternate between two parts across rounds.

These are the same shape as the entry gestures: named, pure, auditionable. They
are NOT a new scheduler — they resolve to the per-part gain the orchestrator
already applies at one choke point, exactly as `beatMode.ts` and `introBuild.ts`
do today.

**What Beat Mode does when enabled.**

1. **Build the band in, drums first.** The five parts are REVEALED, not started
   (already true in `introBuild.ts` — every generator runs its loop from bar 0
   and is merely inaudible, so nothing re-phases when a part arrives). The lead
   is no longer a random pick of five: Beat Mode names `drums`, and the existing
   `entryOrder(lead)` then yields drums → bass → chord → melody → texture.
   "Foundation before colour" was already the priority table; only the random
   lead is removed. Re-armed on every toggle, so the build is audible each time
   rather than only at session start. (The user said "then same with melody and
   chords" without separating them; the existing table puts CHORD third and
   melody fourth, and that order is kept. Swap it if the ear disagrees.)
2. **A new part arrives every one or two ROUNDS** of what is already playing,
   quantised to the round so it cannot land wrong. Where the harmony happens to
   be at that moment is handled by the landing craft below, not by waiting.
3. **Cohesion is structural, not added.** Every part already seeds from the same
   `songCell` and reads harmony from one authority (`Conductor`:
   `BassGenerator.rootMidi = conductor.currentChord().rootMidi`,
   `ChordGenerator.voicing = conductor.currentChord().pitches`). Beat Mode adds
   no harmony logic; it chooses the MOMENT the band commits to a fresh
   consistent set, via the `sectionVariantKey(lock, pass)` mechanism.
4. **Then it rides, and the moves are available.** No scheduled variation, no
   timer. Once all five are in, the beat holds — and change comes from a MOVE
   (drop / stop-start / trade), triggered by the user in phase 2 and by the
   Organism only once the moves have earned it. Riding unchanged is a valid and
   expected state: repetition is the product.

**Explicitly NOT in scope:** an energy arc that ramps intensity over minutes
(intro→build→drop without sections). That is the song-arc gap; two blind
attempts at it have already failed by ear. Beat Mode's growth is variation on a
locked idea. The dramatic arc remains Song Mode's job.

##### Entry rules — encode the facts, audition the taste

The user's correction, and the reason this is a vocabulary rather than a rule:
"I don't know if I would say never mid-chord, because there are some loops that
can actually drop mid-chord and sound like it fits — so we need to be able to
teach this stuff to the generators or whoever."

Four candidate explanations were put to the user for WHY a mid-chord entry can
work. He could not say which were true ("I really don't know"), which is the
correct answer and the reason this ships as A-then-B rather than as a guess:

| Candidate | Status | Why |
|---|---|---|
| The part carries no harmony (drums, texture) | **Fact — encode now** | Nothing to clash with. Not a taste call. |
| The loop's own phrase divides the chord evenly | **Fact — encode now** | Arithmetic, not opinion. |
| It's a pickup / anticipation into the next chord | **Already exists — reuse** | `ChordImproviser` anticipation + `Conductor.nextChord()`, documented "for anticipatory fills and voiceleading". |
| It's deliberate tension | **Taste — do NOT encode** | Would be invention. |

**Approach A (this spec).** A small pure table of LANDING rules, in the shape of
`beatMode.ts` / `featuredPerformance.ts` / `introBuild.ts` — no Tone.js, no
state, no scheduling, unit-testable without an AudioContext.

The rules answer "the round is up, this part is coming in NOW, how does it land
so it fits the chord that happens to be sounding?" — never "may it come in yet?"
Nothing is ever delayed to wait for the harmony; that would break the launcher
model, which is the whole point.

- Unpitched parts (drums, texture) land as-is. Nothing to clash with — fact.
- A pitched part whose own phrase divides the chord evenly may start its phrase
  from the top; the cycles agree — arithmetic, not opinion.
- Otherwise a pitched part enters on a chord tone of the chord that is ACTUALLY
  SOUNDING, or as a pickup into the next change via the anticipation that
  already exists. What it must never do is start its phrase from the top as
  though the harmony were starting too — that is the audible failure.

Every gesture gets an **audition hook**, the same move `__csbl()` already makes —
a vocabulary you cannot hear cannot be judged.

**Approach B (the road this opens, not built here).** The gestures that survive
the user's ear earn a NAME in CSBL: `bass.enter("pickup")`,
`melody.enter("half-bar late")`. CSBL is where this belongs — "the vocabulary is
the interface; the grid notation is for the machine" — but naming gestures before
knowing which sound good produces a vocabulary of words nobody uses. CSBL itself
got an ear before it got more grammar; this follows that sequence.

Rejected: letting the brain pick each entry per situation. Most flexible, least
predictable — and predictability is the product. It also fights the standing
design that generators make zero network calls.

**Files.** `introBuild.ts` (lead override, harmonic clock, retire the seconds
target), a new pure entry-rules module beside it, `GeneratorOrchestrator.ts`
(wire Beat Mode into the jam-mode branch; re-arm and restore on toggle). No new
scheduler, no second arrangement system.

**Acceptance is by ear.** The tests prove no pitched part enters somewhere the
rules disallow, and that the build advances on the harmonic clock. They cannot
prove it sounds like a real tune — that is the user's ear, and it is the only
acceptance test that counts.
