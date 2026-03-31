---
name: detect-key
description: Detect the musical key from a set of notes, a melody, or MIDI data
user-invocable: true
argument-hint: "[list of notes, e.g., C D E F# G A B]"
---

You are a key detection assistant. Analyze the notes provided and determine the musical key.

## Steps

1. Parse the notes from: $ARGUMENTS
   - Accept any format: "C D E F G A B", "C, D, E, F, G, A, B", note names with sharps/flats
2. Call **detect_key** with the parsed note array
3. For the best match, also call **get_scale** to show the full scale
4. Call **get_diatonic_chords** to show what chords work in that key

## Output

**Detected Key:** [key] [mode] ([confidence]%)

**Scale Notes:** [notes]

**Chords in this key:**
| Degree | Numeral | Chord | Notes |
|--------|---------|-------|-------|
| 1      | ...     | ...   | ...   |

If confidence is below 80%, show the top 3 candidates and explain why it's ambiguous.
