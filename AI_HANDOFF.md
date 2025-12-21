# AI Handoff Context

This file helps Replit Agent and Windsurf/Cascade share context when working on this project.

---

## Last Updated
**Date:** December 21, 2025  
**By:** Replit Agent  

---

## Current State
All previous tasks completed. Project is stable and running.

---

## Recent Changes
- **ProBeatMaker**: Beat patterns persist to localStorage (tracks, bpm, patternLength)
- **Audio Export**: Notes use time/duration format with drumType for proper playback
- **Navigation**: After "Send to Timeline" goes to /studio, after "Route to Mixer" goes to /mixer
- **MIDI Mapping**: Fixed drum mapping panel with GM defaults and MIDI Learn mode
- **Computer Keyboard Hook**: New `use-computer-keyboard.ts` for piano key mapping

---

## In Progress
Nothing currently in progress.

---

## Next Steps / Backlog
- Integrate computer keyboard hook into VerticalPianoRoll, BassStudio, MelodyComposer
- Review IMPLEMENTATION_PRIORITY_GUIDE.md for next features
- Consider AI provider optimizations per AI_PROVIDER_MAPPING.md

---

## Key Files to Know
| File | Purpose |
|------|---------|
| `replit.md` | Full project documentation and architecture |
| `client/src/components/studio/ProBeatMaker.tsx` | Beat maker with persistence |
| `client/src/hooks/use-computer-keyboard.ts` | QWERTY to piano notes hook |
| `docs/IMPLEMENTATION_PRIORITY_GUIDE.md` | Feature roadmap |

---

## Notes for Next Agent
- Project uses React + TypeScript + Vite (frontend) and Express (backend)
- Audio uses Tone.js and soundfont-player
- All shadcn/ui components available at `@/components/ui/`
- Database is PostgreSQL with Drizzle ORM
- Refer to `replit.md` for full context

---

## How to Use This File
1. **Before starting work**: Read this file to understand current state
2. **During work**: Update "In Progress" section
3. **After finishing**: Move completed items to "Recent Changes", clear "In Progress", update "Next Steps"
4. **Always update**: The "Last Updated" timestamp and "By" field
