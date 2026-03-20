# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
Providers nest in this order inside `App.tsx`:
```
PresenceProvider → TransportProvider → GlobalAudioProvider → InstrumentProvider →
TrackStoreProvider → StemGenerationProvider → AstutelyCoreProvider →
StudioSessionProvider → SongWorkSessionProvider → SessionDestinationProvider
```
`GlobalOrganismWrapper` wraps the entire app (outside routing).

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
- `server/storage.ts` exports a `storage` singleton (MemStorage in dev, DatabaseStorage in prod).
- Vite dev server proxies `/api/*` to Express on port 4000.
- `AI_HANDOFF.md` in the root tracks cross-session context — update it after major changes.
