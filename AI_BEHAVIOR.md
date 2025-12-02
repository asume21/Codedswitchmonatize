# AI Behavior and Tooling Rules

## 1. Tool / Button Categories

### 1.1 Random Tools
- Labels: `Random`, `Shuffle`, `Humanize`, `Chaos`, etc.
- May use pure logic, randomness, and/or AI.
- Must **not** imply AI (in label or tooltip) unless an AI model is actually called for that click.

### 1.2 AI Tools
- Labels that contain `AI`, `Grok`, `LLM`, or clearly present themselves as AI-driven.
- Every click **must**:
  - Call a real model (e.g. via `callAI`, MusicGen, transcription model, etc.).
  - Use only the model's creative output, plus minimal normalization (e.g. clamp values, trim arrays, fix JSON).
- If the model call fails or returns unusable data:
  - Return an error from the route.
  - Do **not** generate or modify creative content (beats, melodies, lyrics, mix, etc.) using hard-coded patterns or randomness.
  - Leave the user's existing content unchanged.

### 1.3 Manual Tools
- Labels: `Draw`, `Erase`, `Add Note`, `Copy`, `Paste`, `Nudge`, etc.
- Purely logical/editing operations; no AI calls.
- AI must never run unless the user invokes an AI-labeled control.

## 2. Creative Content Rules

- Each AI action must have a clear scope (e.g. "Beat", "Melody", "Lyrics"). It must not silently modify other sections.
- Non-AI logic may normalize AI output (e.g. enforce length, clamp to 0/1, fix malformed JSON) but must **not** invent new creative structure when the user asked for AI.

## 3. Failure Behavior

- If AI is unavailable, misconfigured, times out, or returns malformed output:
  - The route answers with a clear error message.
  - The frontend should show an error state/toast.
  - No content is auto-generated as a replacement.
  - The user's existing pattern/notes/lyrics remain unchanged.

## 4. No Fake AI / No Shells

- No feature may present itself as "AI" while returning hard-coded or purely logical content.
- No screen or button that looks finished may secretly be a non-functional or placeholder shell.
  - If something is still WIP, it must be hidden behind a feature flag or clearly labeled as experimental/coming soon.

These rules apply across all creative flows: beat maker, piano roll, code→music, upload + analyze, lyrics, and mix/master tools.
