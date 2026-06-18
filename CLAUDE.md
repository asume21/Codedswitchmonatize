# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Continuity — assume the user is CONTINUING prior work

A new chat almost always continues work from a previous one, and the user will NOT
always say "this is the thing from before." Treating a continuation as a brand-new
idea — and designing/building from scratch — is how this repo accumulates duplicate
specs and competing systems (the "doubles"). Before acting on the first request:

1. **Search before you build.** Check `docs/superpowers/specs/` and
   `docs/superpowers/plans/`, recent `git log`, the auto-memory `MEMORY.md`
   pointers, and the relevant code for the topic. A SessionStart hook surfaces
   recent commits + the specs/plans list at the start of every session — read it.
2. **Extend, never duplicate.** If a spec/plan already covers the topic, continue
   THAT file. Do not write a second spec for the same concern — consolidate into
   the existing one.
3. **When in doubt, ask if this continues earlier work** before starting a design.

## Project Overview

**CodedSwitch Studio** — an AI-powered music creation SaaS platform. Users compose multi-track music (beat maker, piano roll, melody composer, mixer), use AI to generate/layer audio, scan code for vulnerabilities, and share songs socially. Billing is via Stripe with a credit system.

## Commands

```bash
# Development (runs client on :5000 and server on :4000)
npm run dev

# Build for production
npm run build

# Type checking
npm run check

# Linting
npm run lint
npm run lint:fix

# Tests
npm test              # Playwright E2E
npm run test:unit     # Vitest unit tests
npm run test:ui       # Playwright with UI

# Database schema push
npm run db:push
```

## Architecture

### Stack
- **Client:** React 18, Vite, TypeScript, TailwindCSS, shadcn/ui (Radix), Wouter router, TanStack Query, Zustand
- **Audio:** Tone.js, Web Audio API, Web MIDI API, soundfont-player (General MIDI)
- **Server:** Express 4, TypeScript, PostgreSQL, Drizzle ORM
- **AI:** xAI Grok (primary), OpenAI, Gemini, HuggingFace, Replicate, Anthropic
- **Payments:** Stripe subscriptions + credit ledger
- **Storage:** Google Cloud Storage / AWS S3

### Monorepo Layout
```
client/src/   — React frontend
server/       — Express backend
shared/       — Drizzle schema + shared TypeScript types
```
All three share one root `package.json` and `tsconfig.json`.

### Frontend Routing (`client/src/App.tsx`)
Uses Wouter. Routes split into three tiers:
1. **No providers** — `/`, `/login`, `/signup`
2. **Lightweight providers** — `/dashboard`, `/social-hub`, `/settings`, `/ai-assistant`, `/vulnerability-scanner`, etc.
3. **Full audio provider stack** — `/studio` only (and `/lyric-lab` which opens studio to the lyrics tab)

All legacy studio routes (`/beat-studio`, `/melody-composer`, `/piano-roll`, etc.) redirect to `/studio`.

### Audio Provider Stack (studio only)
Providers nest in this order inside `App.tsx` (outermost → innermost):
```
PresenceProvider → TrackStoreProvider → TransportProvider → GlobalAudioProvider →
InstrumentProvider → StemGenerationProvider → AstutelyCoreProvider →
StudioSessionProvider → SongWorkSessionProvider → SessionDestinationProvider
```
TrackStoreProvider must wrap TransportProvider because TransportProvider calls `useTrackStore()`.
`GlobalOrganismWrapper` wraps the entire app (outside routing).

### Single Source of Truth — Audio Clock
- **TransportContext** is the sole owner of `Tone.Transport.start/stop` and `pianoRollScheduler` lifecycle.
- **`getAudioContext()`** (`client/src/lib/audioContext.ts`) is the single shared `AudioContext` — all components must use it (no `new AudioContext()`).
- The Organism's `GeneratorOrchestrator` does NOT stop Tone.Transport — it only silences its generators. It will defensively start Transport if not already running.

### Studio UI (`client/src/components/studio/UnifiedStudioWorkspace.tsx`)
Workspace is consolidated into **4 core surfaces** (not a flat tab list):

1. **MAKE** — live performance and voice (real-time capture/looping, vocal input).
2. **MIX** — production canvas: Beat Maker, Piano Roll, Mixer.
3. **SHARE** — Social Hub and user/artist profiles.
4. **LIBRARY** — Sample Library and saved beats/projects.

Each surface is a separate component. Legacy tab placements:
- **Lyrics** — primary home is **MAKE** (live writing during performance); also mounted as a side-panel inside **MIX** for track-attached editing.
- **Song Uploader** — moved into **LIBRARY**.
- **Code Translator** and **AI Assistant** — removed as tabs entirely. Both are being rebuilt as **global overlays** triggered from the ⌘K Command Palette, available from any surface.

### Organism / AI Agent System (`client/src/features/organism/` + `client/src/organism/`)
The "Organism" is the AI music generation agent. It orchestrates generators via `GeneratorOrchestrator.ts`. `OrganismProvider` / `OrganismContext` expose controls; `GlobalOrganismWrapper` keeps it alive across all routes.

### Server Routes (`server/routes/`)
All mounted at `/api/*`. Key modules: `ai.ts`, `audio.ts`, `songs.ts`, `social.ts`, `astutely.ts`, `lyrics.ts`, `credits.ts`, `auth.ts`, `vulnerability.ts`, `voiceConvert.ts`, `stemGeneration.ts`.

### Shared Schema (`shared/schema.ts`)
Drizzle ORM table definitions used by both server (queries) and client (inferred types). Core tables: `users`, `userSubscriptions`, `creditTransactions`, `projects`, `beatPatterns`, `melodies`, `lyrics`, `vulnerabilityScans`.

### Key Patterns
- `client/src/main.tsx` imports `./lib/globalAudioKillSwitch` **first** — this patches `window.Audio` globally before React mounts.
- `server/storage.ts` exports a `storage` singleton (MemStorage in dev, DatabaseStorage in prod).
- Vite dev server proxies `/api/*` to Express on port 4000.
- `AI_HANDOFF.md` in the root tracks cross-session context — update it after major changes.
