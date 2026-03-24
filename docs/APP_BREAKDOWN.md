# CodedSwitch — Complete App Breakdown

**URL:** [Production Site]  
**Stack:** React + TypeScript (Vite) | Express + Node.js | PostgreSQL | Tone.js | Zustand  
**Status:** Production-deployed, pre-launch (0 users)

---

## What Is It?

CodedSwitch is an **AI-powered music production platform** built for hip-hop artists, freestylers, singers, and beat makers. It combines a full browser-based DAW (Digital Audio Workstation) with a unique AI system called the **Organism** that generates live music in response to your voice, and a **Social Hub** for community and collaboration.

Think of it as: **GarageBand meets TikTok meets an AI that jams with you.**

---

## The Two Pillars

### 1. The Organism (AI Music Agent)

The Organism is the app's killer feature — a **living music system** that listens to you through the microphone and generates a complete beat (drums, bass, melody, texture) in real time, tuned to your voice.

**How it works:**
- You open the Organism and start rapping, singing, or just talking
- The AI analyzes your audio in real-time (pitch, energy, rhythm, presence)
- A physics engine converts your voice data into musical parameters
- Four generators (Drum, Bass, Melody, Texture) produce music that reacts to you live
- The Scale Snap Engine detects what key you're in and locks the music to it
- A 28-bar arrangement cycle (intro → verse → build → drop → breakdown → drop 2 → outro) plays out as you perform

**Key Organism Features:**
| Feature | What It Does |
|---------|-------------|
| **5 Physics Modes** | Heat (aggressive), Ice (clean/sparse), Smoke (laid-back), Gravel (gritty), Glow (uplifting) — each mode is a complete sonic world |
| **Count-In Start** | Count "1-2-3-4" and the beat drops on 1 — no click track needed |
| **Call & Response** | When you pause, the melody answers — your silence becomes part of the composition |
| **Drop Detector** | Detects energy spikes in your delivery and triggers arrangement drops |
| **Cadence Lock** | Locks the melody rhythm to your speech cadence so your bars land on beat |
| **Voice Commands** | Say "drop it", "heat mode", "slow down" — the studio responds to your words |
| **Freestyle Report Card** | After each session, get a breakdown of rhythmic consistency and flow depth |
| **Scale Snap Engine** | Auto-detects your musical key and locks all generators to it |
| **Session Recording** | Records your vocal, the beat, and MIDI data — export everything |
| **MIDI Export** | Download your Organism session as a MIDI file to use in any DAW |

---

### 2. Social Hub (Community Platform)

A built-in social network for music creators.

**Tabs & Features:**
| Tab | What It Does |
|-----|-------------|
| **Feed** | Post status updates, share beats/projects. Like, comment, reshare |
| **Connections** | Follow/unfollow producers. See who's online. Build your network |
| **Chat** | Direct messaging between producers. Share audio clips and project invites |
| **Collabs** | Invite other producers to collaborate on projects. Set permissions, track contributions |
| **Blog** | Read and write articles about music production, techniques, releases |
| **Discover** | Find new producers by genre, style, or activity |
| **Analytics** | Track your reach, engagement, followers, and content performance |

**Social Sharing:** One-click share to Twitter/X, Instagram, YouTube, Facebook  
**Public Song Pages:** Shareable links (`/s/:id`) for any published track

---

## The Studio (Full DAW)

Everything below lives under `/studio` — a unified workspace with tabs:

### Beat Making & Composition
| Tool | What It Does |
|------|-------------|
| **Beat Lab** | Drum sequencer with kick, snare, hi-hat, perc tracks. Per-step velocity, probability, swing |
| **Piano Roll** | Full vertical piano roll editor — draw/edit MIDI notes, quantize, transpose, velocity editing |
| **Melody Composer V2** | AI-assisted melody generation with scale-aware note placement |
| **Chord Progression Display** | Visual chord progression viewer and editor |
| **Arpeggiator** | Pattern-based arpeggiator with rate, octave, and direction controls |
| **Dynamic Layering** | Stack multiple instruments on the same pattern |
| **Key/Scale Selector** | Set the musical key and scale for the entire session |

### Mixing & Mastering
| Tool | What It Does |
|------|-------------|
| **Mixer** | Multi-channel mixer with volume, pan, mute, solo per track |
| **Mixer With Buses** | Advanced routing: aux sends, return buses, group buses, master bus |
| **Effects Chain** | Per-track effect chains — EQ, Compressor, Reverb, Delay, Chorus, Limiter, Noise Gate, De-esser, Saturation |
| **AI Mastering** | One-click AI mastering with loudness targeting |
| **Freeze/Bounce** | Freeze tracks to reduce CPU load, bounce to audio |
| **Export Studio** | Export final mix as WAV/MP3 with format and quality options |

### AI-Powered Tools
| Tool | What It Does |
|------|-------------|
| **Astutely AI Brain** | The AI assistant that generates beats, melodies, and chord progressions from text prompts. Supports multiple AI models (Grok, GPT, Gemini) |
| **AI Loop Generator** | Generate loops from text descriptions |
| **AI Bass Generator** | Generate bass lines that fit your beat |
| **AI Vocal Melody** | Generate vocal melody suggestions |
| **AI Arrangement Builder** | Auto-arrange your tracks into a full song structure |
| **AI Stem Separation** | Upload a mixed track → get separated stems (vocals, drums, bass, other) |
| **AI Assistant Chat** | Natural language chat for music production help and DAW control |
| **Floating AI Assistant** | Persistent AI assistant overlay accessible from anywhere in the studio |

### Unique / Experimental
| Tool | What It Does |
|------|-------------|
| **Code to Music** | Paste code → get a musical composition derived from the code's structure |
| **Lyric Lab** | AI-powered lyrics writing with rhyme suggestions, syllable counting, and structure templates |
| **Voice Convert (RVC)** | AI voice conversion — transform vocals to sound like different voices/styles |
| **Sample Library** | Browse and preview a library of audio samples, drag into your project |
| **MIDI Controller** | On-screen MIDI controller for playing instruments |
| **Performance Metrics** | Real-time CPU, memory, and audio latency monitoring |

### Project Management
| Feature | What It Does |
|---------|-------------|
| **Auto-Save** | Saves every 30 seconds if changes detected |
| **Project Save/Load** | Save/load full project state (tracks, notes, mixer settings, automation) |
| **Project Export** | Download `.cswproj` file for backup |
| **Undo/Redo** | Full undo/redo timeline with localStorage persistence |
| **Checkpoints** | Auto-creates restore points on save/load events |

---

## Monetization

| Feature | Details |
|---------|---------|
| **Credit System** | Users buy credits to use premium AI features |
| **Pro License** | Gated features (save, export, advanced AI) require Pro subscription |
| **Stripe Integration** | Checkout, webhooks, subscription management via Stripe |
| **Tier Enforcement** | Server-side middleware enforces feature access by subscription tier |

---

## Technical Architecture

### Frontend
- **React 18** with TypeScript, built with **Vite**
- **Zustand** for global state management (BPM, key, time signature, transport, generated content)
- **Tone.js** for Web Audio synthesis and playback
- **TailwindCSS** for styling (dark cyberpunk/holographic theme — "Astutely" design system)
- **Wouter** for routing
- **TanStack Query** for server state

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** with Drizzle ORM
- **Session auth** (express-session + connect-pg-simple)
- **Rate limiting** on all API endpoints
- **Helmet** security headers

### API Surface (28 route files)
| Route Group | Endpoints | Purpose |
|-------------|-----------|---------|
| `/api/auth` | 5 | Login, signup, session, logout |
| `/api/user` | 6 | Profile, settings, preferences |
| `/api/songs` | 20 | CRUD for songs/projects |
| `/api/audio` | 17 | Audio upload, processing, analysis |
| `/api/social` | 21 | Feed, posts, follows, chat, collabs |
| `/api/ai` | 7 | AI generation (beats, melodies) |
| `/api/astutely` | 7 | Astutely-specific AI endpoints |
| `/api/credits` | 9 | Credit purchase, balance, usage |
| `/api/lyrics` | 5 | AI lyrics generation |
| `/api/mix` | 4 | Mix/master processing |
| `/api/samples` | 6 | Sample library browsing |
| `/api/voiceConvert` | 12 | RVC voice conversion pipeline |
| `/api/blog` | 4 | Blog posts CRUD |
| `/api/vulnerability` | 3 | Code vulnerability scanning |
| `/api/organism` | 6 | Organism session data, profiles |
| + 13 more | ... | Billing, stems, keys, packs, etc. |

### Audio/Music Infrastructure
- **Organism Engine** — Custom physics-based generative music system
  - `GeneratorOrchestrator` (drum, bass, melody, texture generators)
  - `ScaleSnapEngine` (real-time key detection)
  - `CaptureEngine` → `SessionRecorder` → `MidiExporter`
  - `CadenceLock`, `DropDetector`, `VibeMatcher`, `FreestyleReportCard`
- **Audio Analysis Service** — Python-based (Dockerfile, inference pipeline)
- **1,897 audio samples** included (hi-hats, kicks, snares, etc.)

---

## Page Map

| Route | What Loads | Auth Required? |
|-------|-----------|----------------|
| `/` | Landing page (marketing) | No |
| `/login` | Login form | No |
| `/signup` | Signup form | No |
| `/dashboard` | Quick-action cards to all tools | Yes |
| `/studio` | Full DAW workspace (all tools) | Yes |
| `/organism` | Studio opened to Organism tab | Yes |
| `/lyric-lab` | Studio opened to Lyrics tab | Yes |
| `/social-hub` | Social Hub (feed, chat, collabs, discover) | Yes |
| `/profile` | User profile page | Yes |
| `/ai-assistant` | Standalone AI chat | Yes |
| `/voice-convert` | RVC voice conversion | Yes |
| `/sample-library` | Browse audio samples | Yes |
| `/blog` | Blog listing | No |
| `/blog/:slug` | Blog post | No |
| `/s/:id` | Public shared song page | No |
| `/settings` | Account settings | Yes |
| `/buy-credits` | Credit purchase | Yes |
| `/subscribe` | Pro subscription | Yes |
| `/vulnerability-scanner` | Code security scanner | Yes |

---

## What Makes It Different

1. **The Organism** — No other browser DAW has a live AI that generates music from your voice in real-time. FL Studio, BandLab, Soundtrap — none of them do this.

2. **Freestyle-First** — Most DAWs are built for producers who click notes into a grid. CodedSwitch is built for performers who want to rap/sing and have the beat built around them.

3. **All-in-One** — Studio + Social + AI + Community in one app. No need to make beats in one app, share on another, collaborate through email.

4. **Browser-Based** — Nothing to install. Works on any device with a browser and microphone.

5. **Physics-Based Music** — The Organism doesn't use loops or presets. Every sound is generated from a physics engine that responds to real-time input.

---

## Current Status

- **Deployed to production** (Railway)
- **0 active users** — no marketing or launch has happened yet
- **All features functional** — Studio, Organism, Social Hub, AI tools all working
- **Landing page** — Full marketing page with feature sections, waitlist signup
- **State management refactored** — Single Zustand store for all musical globals (BPM, key, time signature), Organism output now bridges into Piano Roll and Beat Lab

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Pages | 20+ |
| Studio Components | 57+ |
| Server API Routes | 155+ endpoints across 28 files |
| Audio Samples | 1,897 |
| AI Models Supported | Grok, GPT, Gemini |
| Effect Plugins | 9 (EQ, Comp, Reverb, Delay, Chorus, Limiter, Gate, De-esser, Saturation) |
| Organism Physics Modes | 5 (Heat, Ice, Smoke, Gravel, Glow) |
