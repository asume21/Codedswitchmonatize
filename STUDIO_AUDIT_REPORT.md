# CodedSwitch Studio Audit Report & Punch List
Generated: December 31, 2025

## 1. Executive Summary
The CodedSwitch Studio is a feature-rich React/Express application that suffered from significant **API/UX drift**. Many frontend features (Music-to-Code, Mixer Studio, AI Generation) were disconnected from the backend or targeting non-existent endpoints. We have successfully restored core AI connectivity, but several UI/UX and stability issues remain.

## 2. Priority 1: Critical Bugs (The "Fix Now" List)
- [x] **VerticalPianoRoll Crash**: Fixed null reference on `selectedTrack`.
- [x] **Lyric Lab Scrolling**: Fixed issue where transcribed lyrics were unreachable.
- [x] **Beat Studio "Apply AI"**: Fixed button to trigger real AI generation instead of static presets.
- [x] **Audio Engine Polyphony**: Fixed `realisticAudio` to support multiple concurrent instrument loads without crashing the audio context.
- [ ] **MIDI Engine "Stuck Notes"**: MIDI polyphony can still lead to hanging notes if not cleaned up properly.
- [ ] **Instrument Selector Sync**: Changing an instrument in the Piano Roll does not always update the playback buffer immediately.

## 3. Priority 2: API & Integration (Restored Connectivity)
- [x] **Audio Router Mount**: Mounted `createAudioRoutes` under `/api` and `/api/audio`.
- [x] **Music-to-Code Endpoint**: Implemented real `/api/music-to-code` with AI analysis.
- [x] **Mixer Studio Endpoints**: Implemented `/api/audio/layered-composition` and `/api/audio/export-master`.
- [x] **Circular Translation**: Implemented `/api/test-circular-translation` diagnostic endpoint.
- [ ] **Legacy Route Cleanup**: Over 1,000 lines of unmounted routes in `server/routes/index.ts` should be migrated or deleted to reduce technical debt.

## 4. Priority 3: UI/UX & Navigation (The "Polish" List)
- [x] **Master Multi-Track Player**: Fixed vertical scrolling to reveal the mixer and footer.
- [x] **Loop Maker Visibility**: Exposed the "AI Loop Generator" toggle in the Piano Roll.
- [ ] **Nav Duplication**: `GlobalNav.tsx` and `navigation.tsx` overlap. Recommendation: Standardize on `GlobalNav` and remove `navigation.tsx`.
- [ ] **Studio Routing**: Deep-linking to specific Studio tools (e.g., `/studio/mixer`) works but lacks visual feedback in the menu bar.
- [ ] **Mobile Responsive**: Studio workspace is currently unusable on screens < 1024px.

## 5. Concrete Fix Plan
1. **Consolidate Navigation**: Merge overlapping global nav components into a single, reliable system.
2. **Audio State Sync**: Refactor `useAudio` and `realisticAudio` to ensure instrument changes are reactive and instantaneous across all views.
3. **Credit Transparency**: Add real-time credit cost previews to AI buttons before they are clicked.
4. **Error Resilience**: Implement a global Error Boundary specifically for the AudioContext to prevent full-page crashes on audio driver failure.

---
*Audit completed by Cascade AI.*
