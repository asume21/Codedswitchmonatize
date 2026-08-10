# CodedSwitch Beat Language v1 — Full Specification, Engine, and Training Data
Author: Rusty Alsup & Copilot
Version: 1.0
Language Target: Node.js + TypeScript

SECTION 1 — CSBL PHILOSOPHY
CSBL is a hybrid music language combining:
- Producer Vocabulary (instinct)
- Pattern Grammar (precision)
- Block Structure (DAW-like)
- Sound Design Parameters (production)
- Adaptive Syntax (loose for humans, strict for AI)
- Webear Feedback Loop (self-improving beat organism)

SECTION 2 — GENRE MODULES
trap
drill
boom_bap
phonk
detroit
afrobeat
west_coast
lofi
hyperpop

SECTION 3 — INSTRUMENT ROLES
kick
snare
hats
perc
bass
melody
pad
texture
chords
harmony
fx

SECTION 4 — PRODUCER VOCABULARY
Drums:
2-step, triplet-roll, bounce, rimshot, ghost, crunch

Bass:
808-slide, distorted, wobble, glide, sub-heavy

Melody:
dark arp, bell pluck, detuned lead, reverse pad, glassy keys

Chords:
dark minor, sad progression, warm keys, detuned pads

Sound Design:
punchier, wider, warmer, more drive, more glide, dirty, clean

SECTION 5 — PATTERN GRAMMAR
Drums:
x = kick
s = snare
t = hat
p = perc
- = rest
* = repeat

Bass:
b = bass hit
> = slide
~ = sustain

Melody:
c4, d#4, g3 = notes
> = slide
~ = sustain
* = repeat

Chords:
cmin, d#maj, gmin, fmin7 = chords
~ = sustain
* = repeat

SECTION 6 — FUSION SYNTAX
Format:
genre.role("vibe") >> "pattern" {params}

Examples:
trap.hats("2-step") >> "t---t---t---t---" {swing: 0.12}
trap.bass("808-slide") >> "b--b-b--" {drive: 0.8}
lofi.chords("warm keys") >> "cmaj7---dmaj7---" {width: 0.8}

SECTION 7 — BLOCK STRUCTURE
[trap.hats: 2-step]
    pattern: t---t---t---t---
    swing: 0.12
    humanize: 0.03
    velocity: 0.8

SECTION 8 — SOUND DESIGN PARAMETERS
Universal:
detune, drive, reverb, delay, wobble, width, attack, release, cutoff, resonance, humanize, velocity

Kick:
punch, transient, body, saturation

Bass:
glide, sub_boost, distortion

Melody:
shimmer, spread

Chords:
voicing, warmth, pad_depth, stereo_spread

SECTION 9 — TRAINING DATA
Drum Patterns:
trap.hats["2-step"] = "t---t---t---t---"
trap.hats["triplet-roll"] = "t*t*t*t*"
trap.kick["bounce"] = "x---x-x-"
trap.snare["rimshot"] = "--s---s-"
trap.snare["ghost"] = "--s-s---"

drill.hats["helicopter"] = "t-t-t-t-t-t-t-t-"
drill.kick["stutter"] = "x-x-x---"
drill.snare["slide"] = "--s>---"

boom_bap.kick["classic"] = "x-----x-"
boom_bap.snare["crunch"] = "--s---s-"
boom_bap.hats["loose"] = "t--t--t--t--"

Bass Patterns:
trap.bass["808-slide"] = "b--b-b--"
trap.bass["glide"] = "b>b--b--"

phonk.bass["distorted"] = "b--b-b--"
phonk.bass["wobble"] = "b~b~b~b~"

Melody Patterns:
trap.melody["dark arp"] = "c4---d#4---g3---"
trap.melody["detuned lead"] = "c5>g5--g5~--"

lofi.melody["glassy keys"] = "c4---e4---g4---"

Chord Progressions:
trap.chords["dark minor"] = "cmin---d#maj---gmin---"
lofi.chords["warm keys"] = "cmaj7---dmaj7---"
phonk.chords["detuned pads"] = "cmin~--gmin~--"

SECTION 10 — GENRE DNA
Trap:
swing: 0.12
density: medium
brightness: dark
bass: sub-heavy
melody: sparse
chords: minimal

Phonk:
swing: 0.10
density: medium
brightness: retro
bass: distorted
melody: detuned
chords: pads

Lofi:
swing: 0.18
density: low
brightness: warm
bass: soft
melody: nostalgic
chords: jazzy

SECTION 11 — NODE.JS + TYPESCRIPT ENGINE CODE
Parser:
export function parseCSBL(input: string) {
    const block: any = {};

    const header = input.match(/(\w+)\.(\w+)\("([^"]+)"\)/);
    if (header) {
        block.genre = header[1];
        block.role = header[2];
        block.vibe = header[3];
    }

    const pattern = input.match(/>>\s*"([^"]+)"/);
    if (pattern) block.pattern = pattern[1];

    const params = input.match(/\{([^}]+)\}/);
    if (params) {
        block.params = {};
        params[1].split(",").forEach(pair => {
            const [k, v] = pair.split(":").map(s => s.trim());
            block.params[k] = parseFloat(v);
        });
    }

    return block;
}

Pattern Engine:
export function patternToEvents(pattern: string) {
    const events = [];
    let time = 0;

    for (const char of pattern) {
        if (char !== "-") {
            events.push({ symbol: char, time });
        }
        time += 1;
    }

    return events;
}

Sound Design Engine:
export function applySoundDesign(block: any, node: any) {
    const p = block.params || {};

    if (p.detune) node.detune.value = p.detune * 100;
    if (p.drive) node.drive.value = p.drive;
    if (p.reverb) node.reverb.mix = p.reverb;
    if (p.delay) node.delay.time = p.delay;
    if (p.width) node.stereoWidth = p.width;

    return node;
}

Block Renderer:
export function renderBlock(block: any) {
    return {
        header: `[${block.genre}.${block.role}: ${block.vibe}]`,
        pattern: block.pattern,
        params: block.params || {}
    };
}

CSBL Wrapper:
export function CSBL(input: string) {
    const block = parseCSBL(input);

    if (!block.pattern) {
        block.pattern = CSBLGrammar[block.genre][block.role][block.vibe];
    }

    block.events = patternToEvents(block.pattern);
    block.rendered = renderBlock(block);

    return block;
}

---

# SECTION 12 — BUILD BRIEF (added 2026-08-10)

Constraints for whoever writes the TypeScript. These are not style preferences —
each one is a failure this repo has already had.

## Lane

**Everything new goes in `client/src/organism/csbl/`.** Do NOT edit files outside
that folder — no generator, mix, provider or Transport changes. Wiring CSBL into
the live engine is a SEPARATE, later slice. Parallel agents work this tree, and
two of them editing `GeneratorOrchestrator` at once is how work gets lost.

## Non-negotiables

1. **Compile DOWN to the existing types. Never schedule.**
   Drums must emit `DrumHit[]` (`{ instrument: DrumInstrument, time: 'bar:beat:sub',
   velocity: number }`) imported from `../generators/types`. Do NOT invent a new
   event type and do NOT touch `Tone.Transport`. CSBL is a front end that produces
   notes; the Organism remains the only thing that plays them. A second scheduler
   is this repo's #1 recurring defect.

2. **Chords are SCALE DEGREES, not literal names.**
   Write `i`, `VI`, `iv`, `V7` — not `cmin`, `d#maj`. The Conductor owns the key and
   transposes every player together; literal chord names create a second harmony
   authority that fights it. This overrides Sections 5 and 9 of the spec above.

3. **Pure functions, no Tone.js import.**
   Same shape as `organism/generators/beatMode.ts` and `featuredPerformance.ts`:
   pure, dependency-free, unit-testable without an AudioContext. Tests alongside.

4. **Resolve the grammar ambiguities BEFORE writing the parser.** As specced:
   - Step size is undefined. Decide: 1 char = one 16th, and a bar = 16 chars.
     Shorter patterns tile; longer ones are an error, not a truncation.
   - `*` (repeat) has no defined operand — repeat the previous hit, or the pattern?
   - `>` (slide) and `~` (sustain) have no duration model. A slide needs a target
     and a time; a sustain needs a length.
   - `patternToEvents` in Section 11 silently drops `*`, `>` and `~` — three of the
     six symbols. Fix that or cut the symbols.

5. **Fail loudly.** Invalid CSBL must throw or return a typed error with the
   offending character index. Never silently produce an empty or partial pattern —
   today we found three AI/diagnostic paths that swallowed failures and left
   behaviour that looked fine and wasn't.

## Build order — sound first, grammar last

Smallest end-to-end slice that makes NOISE, before any of the wider grammar:

  `trap.hats("2-step")` → parse → `DrumHit[]` → a passing test asserting the exact
  16 slots. One genre, one role.

Then bass, then chords (degrees), then the sound-design params. Do NOT build the
full Section 6 fusion syntax until one role plays end to end.

## Why this order

Measured 2026-08-09/10 against `audio/reference-beats`: our onset density (14.4/sec)
and tempo already MATCH the reference beats. The gap is tone, dynamics and feel —
low-mid congestion, sub deficit, dull top, timing that is too rigid. CSBL's pattern
grammar therefore targets the layer already closest to right.

Section 8 (sound design: punch, transient, body, saturation, glide, sub_boost,
warmth, width, drive) is the part aimed at the ACTUAL gap, and it is the smallest
section in the spec. That weighting is backwards and worth fixing as the language
grows. Vocabulary meanings should be calibrated against blind A/B results
(`scripts/render-ab-variants.mjs`) rather than guessed — the user's ear is the only
reliable judge here, and it has already overturned two confident measurements.

---

# SECTION 13 — KNOWN ISSUES, OBJECTIONS, AND CONTEXT THE IMPLEMENTER LACKS

Written 2026-08-10 for the agent implementing CSBL. Everything here is either a
defect in the spec above, a constraint from the engine CSBL must feed, or a failure
this repo has already had. Read it before writing the parser.

## 13.1 — The grammar has TWO different tokenisations and does not say so

This is the most serious problem in the spec, and it breaks Section 11's engine
immediately.

    Drums:  "t---t---t---t---"      1 CHARACTER = 1 step
    Melody: "c4---d#4---g3---"      1 TOKEN     = 1 step   (c4, d#4 are multi-char)
    Chords: "cmin---d#maj---"       1 TOKEN     = 1 step   (cmin, d#maj)

`patternToEvents` iterates `for (const char of pattern)`, so on a melody line it
reads c, 4, -, -, -, d, #, 4 ... — it will emit garbage for every melodic pattern in
Section 9. Decide explicitly:

  - a lexer that tokenises note names, chord names, single-char drum symbols, and
    the operators, then steps on TOKENS, or
  - separate parsers per role, and say so in the grammar.

Either is fine. Silently sharing one function is not.

## 13.2 — Undefined step size, and the training data does not agree with itself

Section 5 never states what one character is worth. The Section 9 data implies at
least three different answers:

    trap.hats "2-step"        "t---t---t---t---"   16 chars — 16ths, one bar
    trap.kick "bounce"        "x---x-x-"            8 chars — 8ths? half a bar?
    boom_bap.hats "loose"     "t--t--t--t--"       12 chars — does not divide 16
    drill.snare "slide"       "--s>---"             7 chars — divides nothing
    trap.hats "triplet-roll"  "t*t*t*t*"            8 chars WITH repeat operators

Pick one rule and normalise the training data to it. Recommended: 1 char = one
16th, a bar = 16 chars, shorter patterns TILE to fill the bar, non-divisors are a
parse ERROR. The 12-char "loose" is probably meant as triplets — if triplets are
wanted they need their own notation, not a length that happens not to fit.

## 13.3 — Three of the six symbols have no semantics

REPEAT — repeat WHAT? The previous hit, the previous N steps, or the whole pattern?
And for how long? In "t*t*t*t*" it reads like a roll (subdivide this step), which is
a different operation from repeat.

SLIDE — a slide needs a TARGET and a TIME. "b>b--b--" does not say what pitch it
slides to or how long the glide takes. BassGenerator already has setGlideRate(); a
slide should map to it rather than invent a parallel mechanism.

SUSTAIN — needs a LENGTH. Does "b~b~b~b~" mean each note lasts 2 steps, or until the
next hit? The second is more useful and matches how the generators think.

Whatever you choose, write it into the grammar. Section 11's engine currently drops
all three characters on the floor.

## 13.4 — What CSBL must compile INTO (it is a front end, not an engine)

    DrumHit { instrument: DrumInstrument, time: string, velocity: number }

  - DrumInstrument is an enum: Kick | Snare | Hat | Perc
    (client/src/organism/generators/types)
  - time is Tone transport notation "bar:beat:sixteenth", e.g. "0:2:2"
  - velocity is 0..1, NOT 0..127
  - open vs closed hat is decided by VELOCITY, not by a separate instrument:
    above 0.55 voices the open sample (OPEN_HAT_VELOCITY_SPLIT in DrumGenerator).
    So the hat symbol needs a velocity convention, not a second symbol.

Section 3 lists eleven roles (kick, snare, hats, perc, bass, melody, pad, texture,
chords, harmony, fx). The engine has FIVE generators: drum, bass, melody, chord,
texture. "pad" and "harmony" are not separate players, and "fx" has no home. Map
CSBL roles onto the five that exist, or the language will describe instruments that
cannot sound.

## 13.5 — Things that already exist. Do not rebuild them.

  - Per-genre kick/snare skeletons — SKELETONS in
    generators/freeplay/DrumImproviser.ts, 16 genres. CSBL's Section 9 drum data
    overlaps this directly. Decide whether CSBL REPLACES it or FEEDS it. Having both
    is the exact "doubles" failure that has cost this project the most time.
  - Swing per sub-genre — swingForSubGenre(). Section 10's swing values must route
    through it, not add a second swing source (there were once four).
  - 176 chord progressions in Roman numerals —
    generators/patterns/ChordProgressionData.ts. This is why 13.6 matters.
  - Techniques + articulations — a two-layer playing-style engine already exists
    (20 chord techniques, 8 per-note articulations). CSBL's "vibe" concept overlaps
    it. Prefer mapping a vibe onto an existing technique id over a parallel set.
  - Instrument performers — InstrumentRegistry / InstrumentPerformerRouter, with
    per-instrument range, polyphony and articulation defaults.

## 13.6 — Chords MUST be scale degrees (overrides Sections 5 and 9)

Write i, VI, iv, V7 — never cmin, d#maj. The Conductor owns the session key and
transposes every player together. A literal chord name makes CSBL a second source of
harmonic truth: bass, melody and pads would follow the Conductor while the chords
followed the text, and the players would be in different keys. The existing
progression bank is already Roman-numeral based, so degrees are also the format the
engine speaks natively.

## 13.7 — Repo failure modes to avoid (each has actually happened here)

  1. A SECOND SCHEDULER. Never call Tone.Transport.start/stop and never create a
     Tone.Part. TransportContext is the sole clock owner. CSBL produces data.
  2. SILENT FAILURE. Three AI paths in this codebase swallow their own errors and
     leave behaviour that looks fine and is not. Invalid CSBL must throw or return a
     typed error with the offending index. Never return an empty pattern for bad
     input.
  3. A CONTROL NOTHING CAN REACH. A setter with no callers is a default that can
     never be changed — one such flag played a second melody under every take for
     weeks. If CSBL adds options, wire them or do not add them.
  4. COUPLING LEVEL TO EXISTENCE. Setting a volume to 0 elsewhere in this repo also
     DISABLES the generator, so "quiet" silently means "off". Keep CSBL's velocity
     and level purely a level.
  5. A MONOPHONIC INSTRUMENT ON A POLYPHONIC ROLE. Chords voiced onto a mono
     instrument collapse to one note. If CSBL can name instruments it must respect
     canPerformRole().

## 13.8 — The honest objection: this targets the layer already closest

Measured 2026-08-09/10 against audio/reference-beats (the user's own reference set)
using scripts/compare-to-reference.ts:

    onsets/sec      ours 14.4    reference 14.4     already matching
    tempo                        matching
    lowMid 250-2k   ours 51%     reference 32%
    sub 20-80Hz     ours  5%     reference 8.7%
    high 6k-20k     ours 13%     reference 22%
    onset timing SD ours 6.0ms   reference 8.6ms    ours is TOO precise

Note density and tempo already match. The gap is TONE, DYNAMICS and FEEL. CSBL's
pattern grammar (Sections 5, 6, 7, 9 — the bulk of the spec) therefore targets the
layer that is already close, while Section 8 (sound design: punch, transient, body,
saturation, glide, sub_boost, warmth, width, drive) is aimed at the real gap and is
the shortest section in the document.

This is NOT an argument against building CSBL. It is an argument about what to build
FIRST, and about not expecting the pattern grammar to make the beat sound better.
The language earns its keep as (a) the contract an LLM writes music in, (b) direct
authoring control for the user, and (c) product identity. All three are real; none
of them is "fixes the mix".

Blind A/B results so far (scripts/render-ab-variants.mjs), judged by the user's ear:

    WON   harmony channels down 4 dB
    WON   brighter master
    LOST  drums +3 / bass +2        (and it was the LOUDER option)
    LOST  harder compression        (this contradicted the measurements)

That last line is the standing lesson: a confident measurement was overturned by one
blind listen. Calibrate CSBL's vibe words against A/B results rather than intuition.

## 13.9 — Definition of done for slice 1

    parseCSBL('trap.hats("2-step")')  ->  16 DrumHit objects, instrument Hat,
                                          correct times, velocities on the correct
                                          side of the open/closed split, asserted
                                          exactly in a unit test.

No sound design, no chords, no fusion syntax, no engine wiring. One genre, one role,
end to end, with tests. Then bass, then chords (as degrees), then Section 8.
