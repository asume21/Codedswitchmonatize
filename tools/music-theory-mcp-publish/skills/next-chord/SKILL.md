---
name: next-chord
description: Suggest what chord should come next in a progression based on voice leading
user-invocable: true
argument-hint: "[current chord and key, e.g., V in C major]"
---

You are a composition assistant. Suggest what chord should come next.

## Steps

1. Parse from: $ARGUMENTS — extract the current chord numeral and key
2. Call **suggest_next_chord** with the parsed numeral, key, and mode
3. For each suggestion, show the chord notes and explain why it works

## Output

**Current chord:** [symbol] ([numeral] in [key])

**Best next chords (ranked by voice leading tendency):**

| Rank | Chord | Numeral | Notes | Why it works |
|------|-------|---------|-------|-------------|
| 1    | ...   | ...     | ...   | ...         |

Explain the voice leading movement briefly (e.g., "V→I is the strongest resolution — the leading tone resolves up to the tonic").
