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
