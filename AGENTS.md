# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**CodedSwitch Studio** — an AI-powered music creation SaaS platform. Users compose multi-track music (beat maker, piano roll, melody composer, mixer), use AI to generate/layer audio, scan code for vulnerabilities, and share songs socially. Billing is via Stripe with a credit system.

## Commands

```bash
# Development (runs client on :5001 and server on :4001)
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
1. **Minimal page providers** — `/`, `/login`, `/signup` render without studio-only audio providers.
2. **Global transport providers only** — `TrackStoreProvider`, `TransportProvider`, and `GlobalOrganismWrapper` wrap the whole app so the Organism and studio share one transport owner.
3. **Full studio-only audio provider stack** — `/studio` only (and `/lyric-lab` which opens studio to the lyrics tab)

All legacy studio routes (`/beat-studio`, `/melody-composer`, `/piano-roll`, etc.) redirect to `/` or the current `/studio/*` surface depending on the route.

### Audio Provider Stack
`TrackStoreProvider` and `TransportProvider` are global in `App.tsx`, outside routing, because `GlobalOrganismWrapper` can activate on non-studio routes and must share the same `Tone.Transport` owner.

Global providers nest in this order:
```
AuthProvider → TrackStoreProvider → TransportProvider → GlobalOrganismWrapper
```
TrackStoreProvider must wrap TransportProvider because TransportProvider calls `useTrackStore()`.

Studio-only providers nest inside `StudioProviders` in this order:
```
GlobalAudioProvider → InstrumentProvider → StemGenerationProvider →
AstutelyCoreProvider → StudioSessionProvider → SongWorkSessionProvider →
SessionDestinationProvider
```

### Single Source of Truth — Audio Clock
- **TransportContext** is the sole owner of `Tone.Transport.start/stop` and `pianoRollScheduler` lifecycle.
- **`getAudioContext()`** (`client/src/lib/audioContext.ts`) is the single shared `AudioContext` — all components must use it (no `new AudioContext()`).
- The Organism's `GeneratorOrchestrator` requests transport start/stop through `transportController`; it silences its generators directly and does not call `Tone.Transport.start/stop` itself.

### Studio UI (`client/src/components/studio/UnifiedStudioWorkspace.tsx`)
Tab-based workspace. Tabs: Beat Maker, Melody/Piano Roll, Mixer, Lyrics, Code Translator, AI Assistant, Sample Library, Song Uploader. Each tab is a separate component.

### Organism / AI Agent System (`client/src/features/organism/` + `client/src/organism/`)
The "Organism" is the AI music generation agent. It orchestrates generators via `GeneratorOrchestrator.ts`. `OrganismProvider` / `OrganismContext` expose controls; `GlobalOrganismWrapper` keeps it alive across all routes.

### Server Routes (`server/routes/`)
All mounted at `/api/*`. Key modules: `ai.ts`, `audio.ts`, `songs.ts`, `social.ts`, `astutely.ts`, `lyrics.ts`, `credits.ts`, `auth.ts`, `vulnerability.ts`, `voiceConvert.ts`, `stemGeneration.ts`.

### Shared Schema (`shared/schema.ts`)
Drizzle ORM table definitions used by both server (queries) and client (inferred types). Core tables: `users`, `userSubscriptions`, `creditTransactions`, `projects`, `beatPatterns`, `melodies`, `lyrics`, `vulnerabilityScans`.

### Key Patterns
- `client/src/main.tsx` imports `./lib/globalAudioKillSwitch` **first** — this patches `window.Audio` globally before React mounts.
- `server/index.ts` chooses `DatabaseStorage` when a DB URL is present and `MemStorage` only for DB-less development; production refuses to boot without a DB URL.
- Vite dev server proxies `/api/*` to Express on port 4001.
