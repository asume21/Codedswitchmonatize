# GEMINI TASK — Sort loops into coherent loop packs

_Handoff from Claude (working the engine code in parallel). Read this whole file
before editing anything._

## What we're building (context)

The beat engine plays **loop packs** — a genre set of loops (one BPM + one key)
split into five instrument rows: `drums | bass | melody | chords | texture`. An
AI arranger (`server/services/loopMind.ts`, Claude's lane) reads each loop's
**profile card** and decides which loops play in each song section to build a
fire beat. For that to work, the loops have to be **sorted into the right packs
and the right rows.** That sorting is your job — it's musical curation, which
you're great at.

## ⚠️ LANE BOUNDARY (so we don't clobber each other)

Claude is editing the TypeScript engine **right now, in parallel.** To avoid
merge collisions, please touch ONLY:

- ✅ `server/data/loop-packs/*.json` — read + create/edit pack manifests
- ✅ `server/Assets/loop-packs/<packid>/` — copy loop audio files here

Do **not** edit any `.ts` / `.tsx` (especially `server/services/loopMind.ts`,
`client/src/organism/generators/*`). Not because of code quality — purely because
those files are being actively edited and we'd conflict. Stay in the data lane.

## Your task

1. **Read every `server/data/loop-packs/*.json`.** Each loop has a `profile`
   card (`description` + `energy`/`brightness`/`busyness`) written by a model
   that LISTENED to it. **Trust the profile over the file/folder name** — some
   loops are mislabeled (a clip in the `drums` row whose profile says "plucked
   guitar" belongs in `melody`). Move any obviously mislabeled loops to the row
   their profile describes. **Keep the existing `profile` object intact** when you
   move a clip.

2. **Integrate the new loose loops in `D:\downloads`** (BPM + key are in each
   filename, e.g. `soft-guitar-sad-riddim_103bpm_B_minor.wav`):
   - Copy each into `server/Assets/loop-packs/<packid>/`
   - Add it to the matching pack's manifest (group by compatible BPM + key;
     sad/minor melodic loops fit lo-fi / rnb / soul packs)
   - These have no profile yet — **omit the `profile` field**; Claude's profiler
     will fill it in afterward.

## Rules

- A pack = ONE bpm and ONE key (or musically compatible). Don't mix 90 and 140.
- Each loop goes in exactly ONE row, decided by what the profile says it IS:
  - `drums` = drum/percussion grooves
  - `bass` = low-end basslines / 808s
  - `melody` = leads/toplines (guitar lead, bell, synth lead, arpeggio)
  - `chords` = chordal comping / pads playing chords / rhodes / guitar comp
  - `texture` = atmospheres, drones, vinyl, fx beds, reversed/ambient
- A usable pack needs at least `drums` + `bass` + one melodic row.
- Keep each pack one cohesive vibe.

## Manifest schema

```json
{
  "id": "kebab-id",
  "genre": "hip-hop | lo-fi | trap | rnb | soul | ...",
  "bpm": 90,
  "key": "Am",
  "label": "Human-readable name",
  "loops": {
    "drums":   [ { "id": "drums-1", "url": "/api/loops/pack-audio?p=<packid>/<file>.wav", "bars": 4, "label": "...", "profile": { } } ],
    "bass":    [],
    "melody":  [],
    "chords":  [],
    "texture": []
  }
}
```

- `url` is always `/api/loops/pack-audio?p=<packid>/<filename>.wav`.
- `bars` = loop length in bars (2, 4, or 8).
- `profile` = keep as-is when moving a clip; omit entirely for new loops.

## When done

List which packs you created/changed and which loops you moved (and from→to row),
so Claude can run the profiler on the new audio and wire it into the arranger.
```
