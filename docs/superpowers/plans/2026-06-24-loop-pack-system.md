# Loop Pack System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone Loop Pack System where each generator plays a pre-produced audio loop from a genre-matched pack, giving the user a guaranteed-fire beat at the flip of a mode toggle.

**Architecture:** A new `LoopPack` type defines a pack of pre-made loops organized by instrument (drums/bass/melody/chords/texture). Each of the five generators gets two new methods (`loadLoop` / `setLoopMode`) that hot-swap their output from composed notes to a looping `Tone.Player`. The `GeneratorOrchestrator` gains `loadLoopPack` / `clearLoopPack` to distribute loops and flip all generators in one call. `OrganismProvider` exposes a `loopsModeEnabled` flag that triggers the fetch-and-load sequence.

**Tech Stack:** TypeScript, Tone.js (`Tone.Player`), Vitest (unit tests), Express (server routes), existing `createToneMock()` test infrastructure.

## Global Constraints

- Never create a second audio engine — loop players connect to the generator's existing output node (the same one synthesis uses)
- Loop players sync to `Tone.Transport` via `scheduleOnce(..., '@1m')` — quantized to next bar boundary, no clicks
- All five generators must implement identical method signatures for `loadLoop` / `setLoopMode`
- `loopsModeEnabled` defaults to `false` — this feature is opt-in, doesn't change current default behavior
- Pack manifests are JSON files in `server/data/loop-packs/` for dev; serve via existing public `/api/loops` router (no auth needed)
- `npm run check` must pass after every task
- Test command: `npx vitest run <path>`

---

### Task 1: Shared `LoopPack` / `LoopClip` types

**Files:**
- Create: `shared/loopPack.ts`
- Create: `shared/__tests__/loopPack.test.ts`

**Interfaces:**
- Produces: `LoopPack`, `LoopClip` — used by Tasks 2, 3, 4, 5, 6

---

- [ ] **Step 1: Write the failing test**

Create `shared/__tests__/loopPack.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { LoopPack, LoopClip } from '../loopPack'

describe('LoopPack types', () => {
  it('LoopClip has required fields', () => {
    const clip: LoopClip = { id: 'drums-1', url: 'https://example.com/drums.wav', bars: 4 }
    expect(clip.id).toBe('drums-1')
    expect(clip.bars).toBe(4)
  })

  it('LoopPack organises clips by instrument', () => {
    const pack: LoopPack = {
      id: 'hip-hop-classic', genre: 'hip-hop', bpm: 90, key: 'C', label: 'Hip-Hop Classic',
      loops: {
        drums:   [{ id: 'd1', url: '/d1.wav', bars: 4 }],
        bass:    [{ id: 'b1', url: '/b1.wav', bars: 4 }],
        melody:  [{ id: 'm1', url: '/m1.wav', bars: 4 }],
        chords:  [{ id: 'c1', url: '/c1.wav', bars: 4 }],
        texture: [{ id: 't1', url: '/t1.wav', bars: 4 }],
      },
    }
    expect(pack.loops.drums).toHaveLength(1)
    expect(pack.bpm).toBe(90)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```
npx vitest run shared/__tests__/loopPack.test.ts
```
Expected: `Cannot find module '../loopPack'`

- [ ] **Step 3: Create `shared/loopPack.ts`**

```ts
export interface LoopClip {
  id:      string
  url:     string
  bars:    number
  label?:  string
}

export interface LoopPack {
  id:     string
  genre:  string
  bpm:    number
  key:    string
  label:  string
  loops: {
    drums:   LoopClip[]
    bass:    LoopClip[]
    melody:  LoopClip[]
    chords:  LoopClip[]
    texture: LoopClip[]
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```
npx vitest run shared/__tests__/loopPack.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Type check**

```
npm run check
```
Expected: no errors

- [ ] **Step 6: Commit**

```
git add shared/loopPack.ts shared/__tests__/loopPack.test.ts
git commit -m "feat(loops): shared LoopPack + LoopClip types"
```

---

### Task 2: Server — pack API routes + first dev manifest

**Files:**
- Create: `server/data/loop-packs/hip-hop-classic.json`
- Modify: `server/routes/loops.ts` (add `/packs` and `/packs/:id` routes)

**Interfaces:**
- Consumes: `LoopPack` from `shared/loopPack.ts`
- Produces: `GET /api/loops/packs` → `{ packs: LoopPackSummary[] }`, `GET /api/loops/packs/:id` → `{ pack: LoopPack }`

---

- [ ] **Step 1: Create the dev manifest directory and first pack**

Create `server/data/loop-packs/hip-hop-classic.json`:

```json
{
  "id": "hip-hop-classic",
  "genre": "hip-hop",
  "bpm": 90,
  "key": "C",
  "label": "Hip-Hop Classic",
  "loops": {
    "drums": [
      { "id": "drums-boom-1", "url": "/api/loops/audio/drums-boom-90bpm.wav", "bars": 4, "label": "Boom Bap Kit" }
    ],
    "bass": [
      { "id": "bass-funk-1", "url": "/api/loops/audio/bass-funk-90bpm-C.wav", "bars": 4, "label": "Funk Bass" }
    ],
    "melody": [
      { "id": "melody-soul-1", "url": "/api/loops/audio/melody-soul-90bpm-C.wav", "bars": 4, "label": "Soul Lead" }
    ],
    "chords": [
      { "id": "chords-pad-1", "url": "/api/loops/audio/chords-pad-90bpm-C.wav", "bars": 4, "label": "Warm Pad" }
    ],
    "texture": [
      { "id": "texture-vinyl-1", "url": "/api/loops/audio/texture-vinyl.wav", "bars": 4, "label": "Vinyl Crackle" }
    ]
  }
}
```

> **Note:** These URLs point to audio files that must be added to the loop library later. The pack JSON itself is correct — update URLs once real loop audio files are available.

- [ ] **Step 2: Add `/packs` routes to `server/routes/loops.ts`**

Open `server/routes/loops.ts`. After the existing imports, add:

```ts
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

const PACKS_DIR = join(process.cwd(), 'server', 'data', 'loop-packs')
```

Then add these two routes BEFORE `export default router` (or wherever the router is exported — check the file's existing export):

```ts
// List all available packs (id, genre, label, bpm, key only — no loop URLs)
router.get('/packs', (_req: Request, res: Response) => {
  try {
    if (!existsSync(PACKS_DIR)) return res.json({ packs: [] })
    const packs = readdirSync(PACKS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const raw = JSON.parse(readFileSync(join(PACKS_DIR, f), 'utf-8'))
        return { id: raw.id, genre: raw.genre, label: raw.label, bpm: raw.bpm, key: raw.key }
      })
    res.json({ packs })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Full pack manifest including loop URLs
router.get('/packs/:id', (req: Request, res: Response) => {
  try {
    const file = join(PACKS_DIR, `${req.params.id}.json`)
    if (!existsSync(file)) return res.status(404).json({ error: 'Pack not found' })
    const pack = JSON.parse(readFileSync(file, 'utf-8'))
    res.json({ pack })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
```

- [ ] **Step 3: Type check**

```
npm run check
```
Expected: no errors

- [ ] **Step 4: Manual smoke test (dev server)**

```
npm run dev
```
Then in a second terminal:
```
curl http://localhost:4000/api/loops/packs
```
Expected: `{ "packs": [{ "id": "hip-hop-classic", "genre": "hip-hop", ... }] }`

```
curl http://localhost:4000/api/loops/packs/hip-hop-classic
```
Expected: full pack JSON with loops

- [ ] **Step 5: Commit**

```
git add server/data/loop-packs/hip-hop-classic.json server/routes/loops.ts
git commit -m "feat(loops): pack API routes + hip-hop-classic dev manifest"
```

---

### Task 3: Generator loop mode — all five generators

**Files:**
- Modify: `client/src/organism/generators/DrumGenerator.ts`
- Modify: `client/src/organism/generators/BassGenerator.ts`
- Modify: `client/src/organism/generators/MelodyGenerator.ts`
- Modify: `client/src/organism/generators/ChordGenerator.ts`
- Modify: `client/src/organism/generators/TextureGenerator.ts`
- Modify: `client/src/organism/generators/__tests__/__mocks__/toneMock.ts` (add `Tone.loaded`)
- Modify: `client/src/organism/generators/__tests__/DrumGenerator.test.ts` (add loop mode tests)

**Interfaces:**
- Consumes: `LoopClip` from `shared/loopPack.ts`
- Produces on each generator:
  - `loadLoop(clip: LoopClip): Promise<void>`
  - `setLoopMode(enabled: boolean): void`

---

- [ ] **Step 1: Add `Tone.loaded` to the tone mock**

Open `client/src/organism/generators/__tests__/__mocks__/toneMock.ts`.

Find `export function createToneMock()` and add `loaded` to its return object:

```ts
// Add this line inside the createToneMock() return object, alongside `start`:
loaded: vi.fn().mockResolvedValue(undefined),
```

- [ ] **Step 2: Write failing loop-mode tests for DrumGenerator**

Add to the BOTTOM of `client/src/organism/generators/__tests__/DrumGenerator.test.ts`:

```ts
import type { LoopClip } from '@shared/loopPack'

describe('DrumGenerator — loop mode', () => {
  it('loadLoop creates a Tone.Player with loop:true', async () => {
    const { Player } = await import('tone')
    const clip: LoopClip = { id: 'd1', url: 'http://cdn.test/drums.wav', bars: 4 }
    await gen.loadLoop(clip)
    expect(Player).toHaveBeenCalledWith(expect.objectContaining({ url: clip.url, loop: true }))
  })

  it('setLoopMode(true) schedules player start at next bar boundary', async () => {
    const tone = await import('tone')
    const clip: LoopClip = { id: 'd1', url: 'http://cdn.test/drums.wav', bars: 4 }
    await gen.loadLoop(clip)
    gen.setLoopMode(true)
    expect(tone.getTransport().scheduleOnce).toHaveBeenCalledWith(expect.any(Function), '@1m')
  })

  it('setLoopMode(false) stops the player', async () => {
    const tone = await import('tone')
    const clip: LoopClip = { id: 'd1', url: 'http://cdn.test/drums.wav', bars: 4 }
    await gen.loadLoop(clip)
    gen.setLoopMode(true)
    gen.setLoopMode(false)
    // The mock player's stop should have been called
    const mockPlayer = (tone.Player as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(mockPlayer?.stop).toHaveBeenCalled()
  })

  it('setLoopMode(false) before loadLoop does not throw', () => {
    expect(() => gen.setLoopMode(false)).not.toThrow()
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

```
npx vitest run client/src/organism/generators/__tests__/DrumGenerator.test.ts
```
Expected: new loop-mode tests fail with `gen.loadLoop is not a function`

- [ ] **Step 4: Add loop mode to DrumGenerator**

Open `client/src/organism/generators/DrumGenerator.ts`.

Add the import at the top:
```ts
import type { LoopClip } from '@shared/loopPack'
import * as Tone from 'tone'
```
(If `Tone` is already imported, don't add a second import — just add the `LoopClip` type import.)

Find the class declaration and add these private fields near the other private fields:
```ts
private _loopPlayer: Tone.Player | null = null
private _loopMode = false
```

Add these two methods anywhere inside the class body (before the closing `}`):
```ts
async loadLoop(clip: LoopClip): Promise<void> {
  this._loopPlayer?.dispose()
  // Connect to the same output node this generator already uses for synthesis.
  // Find the existing `this.<outputNode>.connect(...)` call in the constructor
  // to identify the right node — typically a Tone.Gain or channel input.
  this._loopPlayer = new Tone.Player({ url: clip.url, loop: true })
    .connect(this.outputGain)   // replace `this.outputGain` with the actual field name
  await Tone.loaded()
}

setLoopMode(enabled: boolean): void {
  this._loopMode = enabled
  if (enabled && this._loopPlayer) {
    Tone.getTransport().scheduleOnce(() => this._loopPlayer!.start(), '@1m')
  } else {
    this._loopPlayer?.stop()
  }
}
```

> **Connecting the loop player:** Look in `DrumGenerator`'s constructor for the line that calls `.connect()` on the first synthesis output. The same node is what `this._loopPlayer` should connect to. Common field names are `this.outputGain`, `this.channel`, `this.busInput`. Replace `this.outputGain` in the code above with whatever that field is.

- [ ] **Step 5: Run tests — verify DrumGenerator loop tests pass**

```
npx vitest run client/src/organism/generators/__tests__/DrumGenerator.test.ts
```
Expected: all tests pass including the 4 new loop-mode tests

- [ ] **Step 6: Add loop mode to the remaining four generators**

Repeat the same pattern (Steps 4–5 equivalent) for each generator. The methods are identical — only the output node field name may differ per generator:

**BassGenerator** (`client/src/organism/generators/BassGenerator.ts`):
```ts
private _loopPlayer: Tone.Player | null = null
private _loopMode = false

async loadLoop(clip: LoopClip): Promise<void> {
  this._loopPlayer?.dispose()
  this._loopPlayer = new Tone.Player({ url: clip.url, loop: true })
    .connect(this.outputGain)   // check constructor for actual field name
  await Tone.loaded()
}

setLoopMode(enabled: boolean): void {
  this._loopMode = enabled
  if (enabled && this._loopPlayer) {
    Tone.getTransport().scheduleOnce(() => this._loopPlayer!.start(), '@1m')
  } else {
    this._loopPlayer?.stop()
  }
}
```

**MelodyGenerator** (`client/src/organism/generators/MelodyGenerator.ts`): same pattern.

**ChordGenerator** (`client/src/organism/generators/ChordGenerator.ts`): same pattern.

**TextureGenerator** (`client/src/organism/generators/TextureGenerator.ts`): same pattern.

For each, add import `import type { LoopClip } from '@shared/loopPack'` at the top.

- [ ] **Step 7: Type check**

```
npm run check
```
Expected: no errors

- [ ] **Step 8: Run all generator tests**

```
npx vitest run client/src/organism/generators/__tests__/
```
Expected: all existing tests still pass, new loop-mode tests pass

- [ ] **Step 9: Commit**

```
git add client/src/organism/generators/DrumGenerator.ts \
        client/src/organism/generators/BassGenerator.ts \
        client/src/organism/generators/MelodyGenerator.ts \
        client/src/organism/generators/ChordGenerator.ts \
        client/src/organism/generators/TextureGenerator.ts \
        client/src/organism/generators/__tests__/__mocks__/toneMock.ts \
        client/src/organism/generators/__tests__/DrumGenerator.test.ts
git commit -m "feat(loops): loadLoop + setLoopMode on all five generators"
```

---

### Task 4: GeneratorOrchestrator — `loadLoopPack` / `clearLoopPack`

**Files:**
- Modify: `client/src/organism/generators/GeneratorOrchestrator.ts`
- Modify: `client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts`

**Interfaces:**
- Consumes: `loadLoop(clip)` / `setLoopMode(bool)` from Task 3; `LoopPack` from Task 1
- Produces:
  - `loadLoopPack(pack: LoopPack): Promise<void>`
  - `clearLoopPack(): void`

---

- [ ] **Step 1: Write the failing tests**

Add to the BOTTOM of `client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts`:

```ts
import type { LoopPack } from '@shared/loopPack'

function makeTestPack(): LoopPack {
  const clip = (id: string) => ({ id, url: `https://cdn.test/${id}.wav`, bars: 4 })
  return {
    id: 'test-pack', genre: 'hip-hop', bpm: 95, key: 'Am', label: 'Test Pack',
    loops: {
      drums:   [clip('d1')],
      bass:    [clip('b1')],
      melody:  [clip('m1')],
      chords:  [clip('c1')],
      texture: [clip('t1')],
    },
  }
}

describe('GeneratorOrchestrator — loop pack', () => {
  it('loadLoopPack calls loadLoop on each generator with the first clip', async () => {
    const orch = new GeneratorOrchestrator(/* pass mocked physics + state engines */)
    // Spy on the internal generators' loadLoop methods
    const spyDrum    = vi.spyOn((orch as any).drum,    'loadLoop').mockResolvedValue(undefined)
    const spyBass    = vi.spyOn((orch as any).bass,    'loadLoop').mockResolvedValue(undefined)
    const spyMelody  = vi.spyOn((orch as any).melody,  'loadLoop').mockResolvedValue(undefined)
    const spyChords  = vi.spyOn((orch as any).chords,  'loadLoop').mockResolvedValue(undefined)
    const spyTexture = vi.spyOn((orch as any).texture, 'loadLoop').mockResolvedValue(undefined)
    vi.spyOn((orch as any).drum,    'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).bass,    'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).melody,  'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).chords,  'setLoopMode').mockImplementation(() => {})
    vi.spyOn((orch as any).texture, 'setLoopMode').mockImplementation(() => {})

    const pack = makeTestPack()
    await orch.loadLoopPack(pack)

    expect(spyDrum).toHaveBeenCalledWith(pack.loops.drums[0])
    expect(spyBass).toHaveBeenCalledWith(pack.loops.bass[0])
    expect(spyMelody).toHaveBeenCalledWith(pack.loops.melody[0])
    expect(spyChords).toHaveBeenCalledWith(pack.loops.chords[0])
    expect(spyTexture).toHaveBeenCalledWith(pack.loops.texture[0])
  })

  it('loadLoopPack sets Transport bpm to pack.bpm', async () => {
    const tone = await import('tone')
    const orch = new GeneratorOrchestrator(/* mocked engines */)
    ;['drum','bass','melody','chords','texture'].forEach(g => {
      vi.spyOn((orch as any)[g], 'loadLoop').mockResolvedValue(undefined)
      vi.spyOn((orch as any)[g], 'setLoopMode').mockImplementation(() => {})
    })
    await orch.loadLoopPack(makeTestPack())
    expect(tone.getTransport().bpm.value).toBe(95)
  })

  it('clearLoopPack calls setLoopMode(false) on all generators', () => {
    const orch = new GeneratorOrchestrator(/* mocked engines */)
    const spies = ['drum','bass','melody','chords','texture'].map(g =>
      vi.spyOn((orch as any)[g], 'setLoopMode').mockImplementation(() => {})
    )
    orch.clearLoopPack()
    spies.forEach(spy => expect(spy).toHaveBeenCalledWith(false))
  })
})
```

> **Note on constructor args:** Look at how the existing `GeneratorOrchestrator` tests construct the orchestrator (they use `createMockPhysicsEngine()` and `createMockStateMachine()` — already defined at the top of the test file). Use the same pattern.

> **Note on internal generator field names:** Check `GeneratorOrchestrator.ts` constructor for the exact private field names. They may be `drumGen`, `bassGen`, etc. Update the `(orch as any).drum` references to match.

- [ ] **Step 2: Run tests — verify they fail**

```
npx vitest run client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts
```
Expected: new tests fail with `orch.loadLoopPack is not a function`

- [ ] **Step 3: Add `loadLoopPack` and `clearLoopPack` to `GeneratorOrchestrator.ts`**

Open `client/src/organism/generators/GeneratorOrchestrator.ts`. Add the import near the top:
```ts
import type { LoopPack } from '@shared/loopPack'
import * as Tone from 'tone'
```
(Add only what isn't already imported.)

Add these methods inside the class body. Use the same field names the existing methods use to reference the five generators — look for where `this.<drumField>.processFrame(...)` is called to identify the correct names:

```ts
async loadLoopPack(pack: LoopPack): Promise<void> {
  // Distribute one loop clip per generator (first clip of each type — V1 selection)
  await Promise.all([
    pack.loops.drums[0]   ? this.drum.loadLoop(pack.loops.drums[0])     : Promise.resolve(),
    pack.loops.bass[0]    ? this.bass.loadLoop(pack.loops.bass[0])      : Promise.resolve(),
    pack.loops.melody[0]  ? this.melody.loadLoop(pack.loops.melody[0])  : Promise.resolve(),
    pack.loops.chords[0]  ? this.chords.loadLoop(pack.loops.chords[0])  : Promise.resolve(),
    pack.loops.texture[0] ? this.texture.loadLoop(pack.loops.texture[0]): Promise.resolve(),
  ])
  // Lock BPM to the pack
  Tone.getTransport().bpm.value = pack.bpm
  // Flip all generators to loop playback
  ;[this.drum, this.bass, this.melody, this.chords, this.texture]
    .forEach(g => g.setLoopMode(true))
}

clearLoopPack(): void {
  ;[this.drum, this.bass, this.melody, this.chords, this.texture]
    .forEach(g => g.setLoopMode(false))
}
```

> Replace `this.drum`, `this.bass`, `this.melody`, `this.chords`, `this.texture` with the actual private field names found in the constructor.

- [ ] **Step 4: Run tests — verify they pass**

```
npx vitest run client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Type check**

```
npm run check
```
Expected: no errors

- [ ] **Step 6: Commit**

```
git add client/src/organism/generators/GeneratorOrchestrator.ts \
        client/src/organism/generators/__tests__/GeneratorOrchestrator.test.ts
git commit -m "feat(loops): loadLoopPack + clearLoopPack on GeneratorOrchestrator"
```

---

### Task 5: OrganismProvider — `loopsModeEnabled` state + pack fetch

**Files:**
- Modify: `client/src/features/organism/OrganismProvider.tsx`
- Modify: `client/src/features/organism/QuickStartPresets.ts`
- Modify: `client/src/features/organism/__tests__/QuickStartPresets.test.ts`

**Interfaces:**
- Consumes: `loadLoopPack(pack)` / `clearLoopPack()` from Task 4; `GET /api/loops/packs/:id` from Task 2
- Produces (on OrganismContext):
  - `loopsModeEnabled: boolean`
  - `setLoopsModeEnabled: (enabled: boolean) => void`

---

- [ ] **Step 1: Add `loopPackId` to QuickStartPreset type and first preset**

Open `client/src/features/organism/QuickStartPresets.ts`.

Find the `QuickStartPreset` interface (or type) and add:
```ts
loopPackId?: string    // ID of the LoopPack to load when Loops Mode is ON
```

Find the hip-hop quick-start preset in the `QUICK_START_PRESETS` array (look for `genre: 'hip-hop'` or similar) and add `loopPackId: 'hip-hop-classic'` to that preset object.

- [ ] **Step 2: Add loopPackId test**

Open `client/src/features/organism/__tests__/QuickStartPresets.test.ts`.

Add this test:
```ts
it('hip-hop preset has a loopPackId', () => {
  const hipHop = QUICK_START_PRESETS.find(p => p.genre === 'hip-hop')
  expect(hipHop?.loopPackId).toBe('hip-hop-classic')
})
```

Run:
```
npx vitest run client/src/features/organism/__tests__/QuickStartPresets.test.ts
```
Expected: passes

- [ ] **Step 3: Add `loopsModeEnabled` state to OrganismProvider**

Open `client/src/features/organism/OrganismProvider.tsx`.

Find the block of `useState` declarations (around line 291 where `songModeEnabled` lives). Add directly below it:
```ts
const [loopsModeEnabled, setLoopsModeEnabledState] = useState(false)
const loopsModeEnabledRef = useRef(false)
```

- [ ] **Step 4: Add the pack-fetch-and-load logic**

Find the `setSongModeEnabled` function in OrganismProvider (around line 3469). Add a parallel function directly below it:

```ts
setLoopsModeEnabled: async (enabled: boolean) => {
  setLoopsModeEnabledState(enabled)
  loopsModeEnabledRef.current = enabled
  const orchestr = orchestrRef.current
  if (!orchestr) return

  if (enabled) {
    const preset = currentPresetRef.current     // the active QuickStartPreset
    const packId = preset?.loopPackId
    if (!packId) {
      console.warn('[loops] No loopPackId for preset', preset?.id, '— staying in generate mode')
      setLoopsModeEnabledState(false)
      loopsModeEnabledRef.current = false
      return
    }
    try {
      const res = await fetch(`/api/loops/packs/${packId}`)
      if (!res.ok) throw new Error(`Pack fetch failed: ${res.status}`)
      const { pack } = await res.json()
      await orchestr.loadLoopPack(pack)
    } catch (err) {
      console.warn('[loops] Failed to load pack:', err)
      setLoopsModeEnabledState(false)
      loopsModeEnabledRef.current = false
    }
  } else {
    orchestr.clearLoopPack()
  }
},
```

> **`currentPresetRef`:** Check OrganismProvider for a ref that tracks the current preset. It may be called `activePresetRef`, `selectedPresetRef`, or similar — look for where `loadArrangementPlan` is called after `composeForPreset(preset)` to find the variable holding the current preset.

- [ ] **Step 5: Expose `loopsModeEnabled` on the OrganismContext value**

Find the large context value object returned at the bottom of OrganismProvider (where `songModeEnabled` is listed). Add:
```ts
loopsModeEnabled,
```
alongside the other mode flags.

Also add the `setLoopsModeEnabled` function to the same object.

Then update `OrganismContext.ts` (the context type definition file) to include:
```ts
loopsModeEnabled: boolean
setLoopsModeEnabled: (enabled: boolean) => void
```

- [ ] **Step 6: Type check**

```
npm run check
```
Expected: no errors. If the context type file has an explicit interface, add the two new fields there.

- [ ] **Step 7: Commit**

```
git add client/src/features/organism/OrganismProvider.tsx \
        client/src/features/organism/QuickStartPresets.ts \
        client/src/features/organism/__tests__/QuickStartPresets.test.ts
git commit -m "feat(loops): loopsModeEnabled state + pack fetch in OrganismProvider"
```

---

### Task 6: UI — Loops Mode toggle button

**Files:**
- Modify: the Organism controls component (find the file that renders the Song Mode toggle — search for `songModeEnabled` in JSX to locate it)

**Interfaces:**
- Consumes: `loopsModeEnabled`, `setLoopsModeEnabled` from OrganismContext (Task 5)

---

- [ ] **Step 1: Locate the Song Mode toggle in the UI**

```
npx grep -r "songModeEnabled" client/src --include="*.tsx" -l
```

Open whichever `.tsx` file renders the toggle button. That's where the Loops Mode button goes.

- [ ] **Step 2: Add the Loops Mode button**

In the same component, import and use `loopsModeEnabled` and `setLoopsModeEnabled` from the Organism context (same hook that provides `songModeEnabled`).

Add a button directly next to or below the Song Mode toggle:

```tsx
<button
  onClick={() => setLoopsModeEnabled(!loopsModeEnabled)}
  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
    loopsModeEnabled
      ? 'bg-purple-600 text-white'
      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
  }`}
  title={loopsModeEnabled ? 'Switch to AI generate mode' : 'Switch to Loops mode'}
>
  {loopsModeEnabled ? 'Loops ✓' : 'Loops'}
</button>
```

- [ ] **Step 3: Grey out the button when no pack is available for current genre**

Wrap the button in a conditional. To know if a pack is available, check `currentPreset?.loopPackId`:

```tsx
{/* Only show Loops button if the current preset has a pack */}
{currentPreset?.loopPackId && (
  <button ...>Loops</button>
)}
```

> If `currentPreset` isn't accessible in this component, either pass it as a prop from the parent or add it to the Organism context (check what data is already exposed there).

- [ ] **Step 4: Type check**

```
npm run check
```
Expected: no errors

- [ ] **Step 5: Manual test**

```
npm run dev
```

1. Open the Organism (http://localhost:5000/organism or /studio)
2. Confirm the "Loops" button appears only for the hip-hop preset
3. Click "Loops" — button highlights purple
4. (Audio won't play until real loop audio files exist at the URLs in the pack manifest — see below)
5. Click "Loops" again — button returns to default, generators resume composing normally

- [ ] **Step 6: Commit**

```
git add <the file you modified>
git commit -m "feat(loops): Loops Mode toggle button in Organism controls"
```

---

## After these tasks: audio files

The system is complete but silent until real loop audio files exist at the URLs listed in `server/data/loop-packs/hip-hop-classic.json`. To hear the beat:

1. Acquire loop WAV files (90 BPM, key of C) for each instrument type
2. Place them in the loop library directory that `melodicLoopLibrary.scan()` reads, OR upload to GCS/S3 and update the URLs in the pack JSON
3. Update `hip-hop-classic.json` with the real URLs
4. Hit play with Loops Mode ON

The pack JSON can be updated any time without a code deploy.
