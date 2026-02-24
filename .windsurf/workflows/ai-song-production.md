---
description: AI-led end-to-end song creation (idea → mastered)
---

## Overview
This workflow guides a user through the full song-making lifecycle using the app’s AI features: ideation, lyrics, structure, patterns, audio generation, vocal integration, mixing, and mastering.

## Steps
1) **Set project context**
   - Decide genre, mood, BPM, key (or leave to AI).
   - Create a new session; ensure env keys (Suno/Replicate, OpenAI/Grok, ElevenLabs if used) are set.

2) **Concept & lyrics**
   - Use **Lyrics Generate** (`/api/lyrics/generate`) with theme/genre/mood.
   - Refine with **Lyrics Analyze** (`/api/lyrics/analyze`) to improve rhyme, syllable balance, and theme fit.

3) **Song plan / structure**
   - Use **AI Song Plan** (`/api/ai/song/plan`) to get sections (intro/verse/chorus/bridge) and durations.
   - Pick target BPM/key from the plan (or set manually).

4) **Pattern creation (editable MIDI)**
   - Use **Astutely pattern** to draft drums/bass/chords/melody.
   - Review in the **Piano Roll**; edit notes if desired.

5) **Real audio generation**
   - Trigger **AI audio** (Suno/MusicGen) for the arrangement.
   - If using “Edit in Piano Roll” after Suno: run **Extract Patterns** (`/api/songs/extract-patterns`) and load both editable notes and the reference audio track.

6) **Vocal path (optional)**
   - Generate vocals with ElevenLabs (voice ID) or in-app vocal tools.
   - Align vocal stem to BPM/key; import as audio track.

7) **Stems / layering (optional)**
   - Run stem separation if you need vocal/instrumental splits for further mixing.

8) **Mix & balance**
   - In the studio, set levels, pans, basic EQ/comp as needed.
   - Use transport loop over the main section to balance.

9) **Master**
   - Export master via the app’s export flow; verify loudness and headroom.
   - Spot-check beginning/ending trims and fades.

10) **Finalize**
    - Save session, render final WAV/MP3, and archive stems.
    - (If deploying) push changes/metadata to repo or asset store.

## Notes
- If local Llama (Ollama) is available, Astutely will prefer it; otherwise it falls back to cloud.
- Keep BPM/key consistent between patterns, audio generation, and vocals for best alignment.
- For best quality: run a final listening pass on headphones and speakers.
