# CodedSwitch Studio - Replit Setup

## Project Overview
CodedSwitch Studio is a revolutionary AI-powered music creation platform that bridges the gap between coding and music composition. It provides professional music production capabilities powered by artificial intelligence.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Express.js + TypeScript (port 3000 in dev, 5000 in production)
- **Database**: PostgreSQL with Drizzle ORM
- **Audio**: Web Audio API, Tone.js, soundfont-player
- **AI Integration**: xAI Grok, OpenAI, Replicate, Google Gemini

## Key Features
- AI-powered music generation (melodies, beats, lyrics)
- MIDI controller support
- Advanced beat creation tools
- Melody composition studio with piano roll editor
- Professional mixer and DAW-like interface
- Code-to-music transformation tools
- Multi-track orchestral composition

## Development Setup

### Running the Project
The project uses a single workflow that runs both frontend and backend:
- **Frontend (Vite)**: Runs on port 5000 with HMR support
- **Backend (Express)**: Runs on port 3000 and serves API endpoints
- **Proxy**: Vite proxies `/api` requests to the backend

### Database
PostgreSQL database is configured and managed via Drizzle ORM.
- Schema location: `shared/schema.ts`
- Migrations: Run `npm run db:push` to sync schema changes

### Environment Variables
Required secrets (configured in Replit Secrets):
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key (auto-configured)

Optional AI API keys (for full functionality):
- `XAI_API_KEY` - xAI Grok for AI music generation
- `OPENAI_API_KEY` - OpenAI for additional AI features
- `REPLICATE_API_TOKEN` - Replicate for MusicGen
- `GEMINI_API_KEY` - Google Gemini for AI features
- `HUGGINGFACE_API_KEY` - Hugging Face for ChatMusician

Optional payment integration:
- `STRIPE_SECRET_KEY` - Stripe for payment processing
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key

## Project Structure
```
/client               - React frontend application
  /src
    /components       - React components
      /studio         - Music studio components
      /ui             - shadcn/ui components
    /pages            - Page components
    /hooks            - Custom React hooks
    /lib              - Utilities and helpers
/server               - Express backend
  /routes             - API route handlers
  /services           - Business logic and AI integrations
  /middleware         - Express middleware
/shared               - Shared types and schemas
```

## Important Notes
- The frontend is configured to work with Replit's proxy system
- HMR (Hot Module Replacement) is configured for secure connections
- Database sessions are stored in PostgreSQL for persistence
- Object storage directory: `/objects`

## Recent Changes (Dec 20, 2025)
- **MIDI Drum Mapping UI** (ProBeatMaker)
  - Fixed mapping panel comparison logic to properly match stored drum types with track IDs
  - Uses DRUM_ID_TO_TYPE normalization for correct display after "Reset to Defaults"
  - MIDI Learn mode, localStorage persistence, and GM default mappings all working
  
- **Computer Keyboard Piano Hook** (`client/src/hooks/use-computer-keyboard.ts`)
  - New reusable hook for mapping QWERTY keys to piano notes
  - Layout: A=C, W=C#, S=D, E=D#, D=E, F=F, T=F#, G=G, Y=G#, H=A, U=A#, J=B, K=C+1
  - Z/X keys for octave down/up
  - Provides noteOn/noteOff callbacks and active key tracking for visual feedback
  - Can be integrated into VerticalPianoRoll, BassStudio, MelodyComposer

- **Master Implementation Priority Guide Created** (`IMPLEMENTATION_PRIORITY_GUIDE.md`)
  - All documentation organized by strategic importance
  - Clear implementation sequence (5 guides in priority order)
  - Week-by-week roadmap for TIER 1/2/3 features
  - Cost optimization checklist (potential 90% savings)
  - Quick reference matrix for which guide to read when
  - Consolidated all AI features, providers, UI improvements, and genre-specific guidance
  
- **Complete Documentation Suite** (5 comprehensive guides):
  1. **AI_FEATURES_RECOMMENDATIONS.md** - 12 AI features (TIER 1/2/3) with implementation timeline
  2. **AI_PROVIDER_MAPPING.md** - 22 music tasks mapped to optimal AI providers with cost analysis
  3. **AI_PROVIDERS_AUDIT.md** - Current assessment with 14 improvement recommendations
  4. **PIANO_ROLL_EDITING_GUIDE.md** - 10 interactive note editing enhancements
  5. **HIPHOP_BASS_GUIDE.md** - Hip-hop production reference (808/sub-bass techniques)

## Previous Changes (Dec 19, 2025)
- **Track System Refactoring**
  - Created canonical TrackPayload interface in `studioTracks.ts` with required fields: type, source, volume, pan, bpm
  - Added DEFAULT_TRACK_PAYLOAD constant and createTrackPayload helper function
  - Updated useTracks hook to enforce required fields with defaults when adding/normalizing tracks
  - Updated MasterMultiTrackPlayer syncFromStore to use normalized track fields with consistent defaults
  - Fixed pre-existing JSX syntax error (orphan touch event handlers moved into canvas element)
- **Bass Studio Audio Fix**
  - Fixed bass line audio rendering - notes are now explicitly included in payload when tracks are added
  - BassStudio and BeatLab both include `notes`, `type`, and `instrument` in payload for MasterMultiTrackPlayer to render audio
  - Cleaned up debug console.log statements from syncFromStore
- **Previous Bass Studio Fixes**
  - Fixed bass line generator - API returns `start` field, client now correctly maps it to `time`
  - Added interactive bass keyboard UI with 12 playable notes (C through B including sharps)
  - Octave selector (1, 2, 3) for different pitch ranges
  - Visual feedback when notes are played
  - Added cleanup effect to dispose Tone.js synths on unmount (memory leak prevention)

## Recent Changes (Dec 18, 2025)
- **AI-Enhanced Code-to-Music**
  - New AI enhancer using OpenAI/Grok for smarter chord progressions and melodies
  - Toggle switch in CodeToMusicStudioV2: "Algorithmic (Fast)" vs "AI-Enhanced (Better)"
  - AI analyzes code complexity, programming language, and structure to generate musical output
  - Automatic fallback to algorithmic mode if AI unavailable
  - Fixed chord parsing for jazz extensions (maj7, m9, add9, add11, dim7, 9, 11, 13)
- **Code-to-Music Algorithm Upgrade**
  - Enhanced genre configs with multiple chord progressions per genre (5+ variations each)
  - Added 3 new genres: Jazz, Lo-Fi, Classical
  - Mood-based chord selection (happy/sad/energetic/calm affect progression)
  - Rich metadata: scales, rhythmic feel, harmonic density, melodic range, tension
  - Using enhanced algorithm with bass lines, pad layers, and advanced drums
  - Added 5 more programming languages: C#, Go, Rust, Ruby, PHP
- **Owner Pro Access**
  - OWNER_EMAIL now grants automatic Pro access with unlimited features
  - License check recognizes owner status for full Pro functionality
- **Audio Transport Seeking**
  - Rewind/fast-forward buttons now actually seek the audio playback
  - Time display syncs with audio.currentTime via timeupdate listener
  - Previous button seeks to start, Next skips to end
- **Email Integration (Resend)**
  - Activation keys now emailed to users when they subscribe via Stripe
  - Uses Resend API with servicehelp@codedswitch.com as sender
  - Activation keys no longer logged to console (security fix)
- **Codebase Cleanup & Consolidation**
  - Removed 8 backup/reject files (.bak, .rej)
  - Deleted 14 unused test scripts from root directory
  - Moved 26 documentation files to docs/ folder for organization
  - Consolidated duplicate components (removed unused BeatMaker variants, empty MelodyComposer files)
  - Deleted unused standalone pages that were never imported
- **Enabled Hidden Features**
  - Added /social-hub route - Social sharing hub for Twitter/Instagram/YouTube
  - Added /profile route - User profile page with song management
- **TypeScript Fix**
  - Created vite-env.d.ts to fix import.meta.env type errors

## Recent Changes (Dec 17, 2025)
- **Security Audit & Fixes** - Addressed critical authentication and session vulnerabilities
  - Session cookies now environment-aware: `secure=true` and `sameSite="none"` only in production
  - `SESSION_SECRET` now required in production - app fails fast if not set
  - Removed debug console logs from auth middleware (security/noise reduction)
  - Added Replit to CORS allowed origins for development
  - Backend runs on port 4000, frontend on port 5000 with Vite proxy

## Recent Changes (Nov 14, 2025)
- ✅ **Mobile Navigation System** - Implemented responsive navigation with single data source
  - Created MOBILE_UX_DESIGN.md specification with comprehensive mobile UX patterns
  - Implemented `useStudioMenuSections` hook for unified navigation data across desktop/mobile
  - Built DesktopMenu using shadcn Sidebar primitives (visible on >=1024px screens)
  - Built MobileMenu using Sheet component for touch-friendly overlay menu
  - Removed legacy hover dropdown menus to eliminate navigation duplication
  - Fixed JSX structure errors by wrapping arrangement view content in React Fragment
  - All navigation now uses consistent data source (no duplication between mobile/desktop)
  - Touch targets follow mobile guidelines: 56px for icon buttons, 48px for tabs, 56px for sheet items

## Recent Changes (Nov 12, 2025)
- ✅ **Unified Studio is Homepage** - Root path (/) now loads Unified Studio workspace
  - "One place for everything" - all workflows accessible from homepage
  - Workflow options: Beginner Guided, Mixing Console, Composition, Immersive Mode
  - Integrated AI Assistant (Grok) for immediate help
  - Song Upload feature available within workflows
- ✅ **Removed Sidebar Navigation** - Clean, distraction-free full-width workspace
  - No sidebar clutter - maximizes screen real estate for music production
  - Top navigation bar for essential controls (credits, login, settings)
  - All tools accessible through Unified Studio workflows
  - Immersive "one place for everything" experience
- ✅ **Song Uploader & Analyzer as MVP** - Featured as first workflow card in Unified Studio selector
  - Positioned first for maximum visibility and prominence
  - AI-powered analysis for BPM, key, structure, and production quality
  - Upload existing songs (MP3, WAV, M4A, OGG) for comprehensive insights
  - Integrated with AI Assistant for contextual help during analysis
- ✅ **Custom DAW Layout System** - Integrated design playground split layout into production
  - Created SplitLayoutRenderer component for flexible panel-based layouts
  - Professional DAW layout: Instruments/Effects (left), Timeline/Piano Roll (center), AI/Mixer (right)
  - New route: `/daw-layout` for custom workspace view
  - Panel sizes configurable via JSON (supports horizontal/vertical splits)
- ✅ **AI Mixing Endpoint** - Created /api/mix/generate with robust validation and ID-based matching
  - Uses Zod schema validation for layer structure and mixing parameters
  - AI suggestions matched by layer ID (not array index) to prevent misapplication
  - All numeric values validated and clamped to safe ranges (volume: 0-100, pan: -50 to 50, effects: 0-100)
  - Intelligent fallback provides genre-appropriate mixing when AI is unavailable
  - Mixing suggestions adapt based on user prompts (punchy, spacious, dry, tight, etc.)
  - No credits required for mixing - works with existing tracks in MixStudio

## Previous Changes (Nov 11, 2025)
- Completed centralized audio routing integration across all studio components
- Added export/routing functionality to BeatMaker with UI dropdown for routing to different audio buses
- Added export/routing functionality to MelodyComposer with similar routing capabilities  
- Updated MixStudio to import tracks from audioRouter with "Import Tracks" button
- Resolved audio fragmentation - all components now use unified audio context
- Implemented audio flow: BeatMaker/MelodyComposer → audioRouter → MixStudio
- All audio playback now uses RealisticAudioEngine's high-quality soundfonts

## Previous Changes (Nov 1, 2025)  
- Configured for Replit environment
- Updated Vite to use port 5000 with proper HMR settings
- Configured backend to use port 3000 in development
- Set up PostgreSQL database with proper migrations
- Updated .gitignore for Replit environment
