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

## Recent Changes (Nov 11, 2025)
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
