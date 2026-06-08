# CodedSwitch — Frontend UI/UX Inventory & Audit

_Generated 2026-06-07. Scope: `client/src` (266 `.tsx` files, ~93k LOC)._

## ✅ Fixed in this pass (verified: `tsc` clean + production build green)

Decision: **single design system = Astutely cyberpunk** (cyan/slate/magenta on near-black).

- **#1 Two design systems** — remapped all shadcn tokens in `index.css` to the astutely palette; the studio shell now inherits cyberpunk with zero component edits. Tinted the hardcoded gray `* {border-color}`, `body`, and scrollbars to tokens. Also fixed the transport bar's hardcoded `bg-gray-900` → `bg-card`.
- **#2 Dead SHARE/LIBRARY stubs** — `StudioShell` now mounts the real Social Hub and Sample Library pages (per CLAUDE.md); "coming soon" stubs + orphaned imports removed.
- **#3 Misleading ⌘K button** — rail button now opens the real command palette via a `codedswitch:open-command-palette` event (label is truthful); fixed the palette's bogus "⌘K" overlay shortcuts; added `aria-label`.
- **#4 GlobalNav overlaps rail** — surface tabs moved to the right of the rail; the wide floating nav now owns the left, no overlap.
- **#5 z-index chaos (chrome tier)** — documented a scale (40 chrome / 50 modals / 100 toasts / 200 util); GlobalNav `z-[9999]→z-40`, transport bar `z-50→z-40` so modals correctly cover persistent chrome. _(Full 72-instance migration still backlog.)_
- **#7 muted-foreground** — now genuinely de-emphasized (was identical to `--foreground`).
- **#9 token format** — `:root`/`.dark` unified to HSL.
- **#10 heading font** — `--font-heading` wired into Tailwind; Poppins + JetBrains Mono now actually loaded in `index.html` (were referenced but never imported).

Remaining backlog: #6 (nav model), #8 (no real light mode — acceptable, app is dark-only by design), #11 (a11y labels), #12 (inline styles), #13–15 (monolith splits, console.*, duplicate component families).

---

## 1. Inventory

### Routing surface (`client/src/App.tsx`)
- **Public/lightweight pages:** `/`, `/login`, `/signup`, `/pricing`, `/blog`, `/sitemap`, `/s/:id` (public song), `/organism` (guest demo), feature landings (`/pro-audio`, `/mix-studio`, `/daw-layout`, `/song-structure`).
- **Protected lightweight:** `/dashboard`, `/onboarding`, `/settings`, `/social-hub`, `/profile`, `/vulnerability-scanner`, `/voice-convert`, `/sample-library`, `/developer`, `/recording-booth`, credits success/cancel.
- **Studio (heavy audio stack):** `/studio/:surface*` → `StudioShell` with surfaces `make | mix | share | library`.
- **~16 legacy redirects** (`/beat-studio`, `/melody-composer`, `/piano-roll`, `/midi-controller`, etc.) → mostly `/`.

### Design system
- `tailwind.config.ts` — standard shadcn token mapping (CSS-var driven).
- `client/src/index.css` (28 KB) — token definitions + ad-hoc global CSS.
- `client/src/styles/astutely-theme.css` (40 KB) — a **second, complete "Holographic Cyberpunk" design system** (cyan/magenta/amber neon, scanlines, grid bg).
- 53 shadcn UI primitives in `components/ui/`.

### Component families (`components/studio/`, 90+ files)
- **Mixers (×3):** `Mixer.tsx`, `MixerWithBuses.tsx`, `ProfessionalMixer.tsx`
- **Beat/step tools (×4):** `BeatLab.tsx`, `ProBeatMaker.tsx`, `StepGrid.tsx`, `sequencer/Sequencer.tsx`
- **AI assistants (×3):** `AIAssistant.tsx`, `FloatingAIAssistant.tsx`, `ai/AstutelyChatbot.tsx`
- **Transport (×3):** `TransportControls.tsx`, `GlobalTransportBar.tsx`, `PlaybackControls.tsx`
- **Code↔music (×2):** `CodeToMusicStudioV2.tsx`, `MusicToCode.tsx` + `CodeTranslator.tsx`
- **Monoliths:** `UnifiedStudioWorkspace.tsx` (221 KB), `MasterMultiTrackPlayer.tsx` (191 KB), `VerticalPianoRoll.tsx` (140 KB), plus `OrganismProvider.tsx` (142 KB), `OrganismCommandCenter.tsx` (106 KB), `SongUploader.tsx` (106 KB).

---

## 2. Issues (ranked by impact)

### 🔴 Critical — coherence & dead ends

1. **Two competing design systems applied simultaneously.**
   - `index.css` defines a neutral dark-gray + blue (`#1e1e1e` / `hsl(203,100%,55%)`) shadcn theme with **Inter**.
   - `App.tsx` then force-sets `document.body.className = 'astutely-app astutely-scanlines astutely-grid-bg …'` and wraps everything in `bg-black/95 text-cyan-100` — a cyan-on-black cyberpunk look.
   - Result: `StudioShell` renders in clean gray shadcn (`bg-background`, `text-muted-foreground`), while `GlobalNav`, landing, error/loading states render in neon cyan/pink. The app looks like two different products depending on the route.

2. **2 of the 4 advertised "core surfaces" are dead stubs.**
   - In `StudioShell.tsx`, `SHARE` and `LIBRARY` render `<SurfaceStub … "coming soon">`.
   - Yet `/social-hub` and `/sample-library` are **fully built separate routes**. The consolidation promised in CLAUDE.md is half-done — users hit "coming soon" for features that exist elsewhere.

3. **Misleading ⌘K affordance.** The studio rail shows a button labeled "⌘K" that opens the **Assistant overlay**, while the real global `<CommandPalette />` (App.tsx) is what actually responds to Cmd/Ctrl+K. Same glyph, two different behaviors.

### 🟠 High — navigation & layout

4. **Floating nav overlaps the studio rail.** `GlobalNav` is `fixed top-4 left-4 z-[9999]`; the studio surface rail is `sticky top-0 z-40 h-12`. The floating hamburger sits on top of the rail's left edge on every studio page.

5. **z-index free-for-all.** 72 occurrences across 38 files, including `z-[9999]` with no shared scale. Overlays, toasts, transport bar, and nav have no coordinated stacking contract → unpredictable layering.

6. **Inconsistent navigation model.** Routing mixes `/social-hub` (standalone) with `/studio/share` (stub), `/sample-library` with `/studio/library` (stub), `/lyric-lab` → `/studio/make`, `/ai-assistant` → `/studio/mix?modal=assistant`. Multiple mental models for "where do I find X."

### 🟡 Medium — token & accessibility hygiene

7. **`--muted-foreground` equals `--foreground`** (`#e0e0e0`). Muted text has no visual de-emphasis → broken typographic hierarchy everywhere muted text is used.

8. **Light/dark are identical.** `:root` and `.dark` define the same values; `darkMode: ["class"]` is configured but there is effectively one (dark) theme. No real light mode despite the machinery.

9. **Token format inconsistency.** Values mix hex (`#1e1e1e`, `#e0e0e0`) and `hsl()` in the same block, making opacity modifiers (`bg-primary/50`) behave inconsistently.

10. **`--font-heading` (Poppins) is defined but never wired into Tailwind** (`fontFamily` only maps sans/serif/mono). Headings fall back to Inter — the generic default the brand presumably wants to avoid.

11. **Accessibility is thin.** Only 51 `aria-label`/`role` occurrences across 23 of 266 components. Audio apps lean heavily on icon-only controls (transport, mixer, step grid) — most lack labels. (Positive: no `<img>` missing `alt`.)

12. **391 inline `style={{…}}` across 30 files** (234 in `OrganismCommandCenter.tsx` alone). Some are unavoidable (computed audio positions), but most defeat the token system and make theming/responsive behavior brittle.

### 🟢 Low — maintainability (indirect UX risk)

13. **Six files over 100 KB**, three over 190 KB. `UnifiedStudioWorkspace.tsx` (221 KB) is the entire MIX surface in one file. Large bundles → slower studio load; hard to keep interactions consistent.

14. **359 `console.*` calls in production `.tsx`** (27 in `MasterMultiTrackPlayer`, 41 in `SongUploader`). Noise + minor perf cost in prod.

15. **Duplicate component families** (mixers ×3, beat tools ×4, AI assistants ×3) mean the same task can look/behave differently depending on which one is mounted. `V2` suffixes suggest undeleted predecessors.

---

## 3. Suggested priorities

1. **Pick ONE design system.** Either commit to the astutely cyberpunk look as the token source of truth (and delete the gray shadcn defaults), or vice versa. Today both ship.
2. **Resolve the 4-surface promise:** mount the real `social-hub` / `sample-library` inside SHARE/LIBRARY, or drop those tabs until ready.
3. **Fix the ⌘K label** and the GlobalNav/rail overlap.
4. **Establish a z-index scale** (e.g. tokens: base/sticky/overlay/toast/max) and migrate the `z-[9999]`s.
5. **Repair muted-foreground contrast** and wire `--font-heading` into Tailwind.
6. Backlog: split the 100 KB+ monoliths; consolidate duplicate mixer/beat/assistant families; strip prod `console.*`.
