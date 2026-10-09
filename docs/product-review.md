# CodedSwitch — Product Review (part by part)

Started 2026-10-07. For each part: what it does, how it works, how the popular
tools do it, what we're missing, and bugs. Visual/chrome issues live in
[`ui-ux-audit.md`](ui-ux-audit.md) — not repeated here.

Order: 1 MIX · 2 MAKE · 3 ASTUTELY · 4 LIBRARY · 5 SHARE · 6 Front door & money
· 7 Side tools · 8 Server/infra.

Severity: 🔴 loses user work / broken promise · 🟠 feature doesn't do what it says
· 🟡 rough edge · 💡 missed opportunity.

---

## 1. MIX — Beat Lab, Piano Roll, Arrangement, Mixer

**Views** (`UnifiedStudioWorkspace.tsx`): arrangement, beat-lab, piano-roll,
mixer, multitrack, lyrics, audio-tools, song-uploader (+ code-to-music, ai-studio).
Plus 12 pop-out windows (`WindowManagerContext.tsx` → `StudioWindowRenderer.tsx`).

### What's strong
- **Mixer** (`ProfessionalMixer`) is genuinely wired to the engine: per-channel
  EQ, send/return buses, sidechain, solo/mute, meters, master spectrum.
- **Piano roll** got a 13-fix cold audit 2026-08-29 (fractional steps, per-track
  undo, MIDI import/export, voice stealing) — not re-audited here.
- Browser autosave + 10 rolling checkpoints exist; MIDI controller support exists.

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| M1 | 🔴 | **Projects never save to the account.** File→Save = `localStorage` + a downloaded `.json`; File→Open = pick a `.json` from disk. No server call. Different computer / cleared browser = work gone. | `UnifiedStudioWorkspace.tsx:2491` `handleSaveProject` |
| M2 | 🔴 | **`/api/projects` does not exist on the server** — never has (checked git history; not a routes-split regression). The Project Manager window's save/list/load all call it → 404. `projects` table exists in `shared/schema.ts`. | `lib/projectManager.ts:233-305` |
| M3 | 🔴 | **Saving is Pro-only.** `requirePro("save")` — free users can't save at all; only the 24h browser autosave protects them. | `UnifiedStudioWorkspace.tsx:2492` |
| M4 | 🔴 | **Recorded takes die on reload.** Takes are stored as `blob:` URLs (live only for the tab). Saved/autosaved projects come back with silent audio tracks. Same for any other `createObjectURL` audio put on a track. | `lib/timelineRecorder.ts:254` → `handleWindowTakeReady` |
| M5 | 🟠 | **6 of 12 pop-out windows get no data.** The single render site passes none of their props: Automation, Effects Chain, Clip Editor, MIDI Editor, Sample Slicer, Project Manager (`onProjectLoaded`). They open empty and edits go to `() => {}`. | `UnifiedStudioWorkspace.tsx:3368` |
| M6 | 🟠 | **13 of 15 automation params do nothing.** Lane dropdown offers reverb/delay/filter/EQ/comp/distortion; playback applies only volume + pan. | `AutomationLane.tsx:29`, `DawArrangementView.tsx:587` |
| M7 | 🟠 | **"Export stems" exports one MIDI file**, not per-track audio. Built a `midiTracks` list then ignored it; audio tracks excluded. | `DawArrangementView.tsx:263` |
| M8 | 🟡 | Automation applied from a React effect per playhead tick → stepped values (zipper noise on fast fades). Should schedule `AudioParam` ramps ahead. | `DawArrangementView.tsx:588` |
| M9 | 🟡 | **Two timelines (a "double").** Arrangement (`DawArrangementView`) and Multitrack (`MasterMultiTrackPlayer`, 191 KB) each have their own clips/export/bounce. The "AI song production" workflow preset opens Multitrack. | `UnifiedStudioWorkspace.tsx:222, 4393, 4583` |
| M10 | 🟡 | **Two automation systems** — window `AutomationLaneEditor` + `automationEngine` (read/write/touch/latch) vs the arrangement's `AutomationLane`. Only the second reaches audio. | M5/M6 |
| M11 | 🟡 | Mobile layout has no branch for `multitrack` / `audio-tools` → blank screen. | `UnifiedStudioWorkspace.tsx:3301-3330` |
| M12 | 🟡 | Autosave writes a full project copy ×11 to `localStorage` every 30s; quota errors are swallowed silently (`catch {}`), so autosave can stop with no warning. | `UnifiedStudioWorkspace.tsx:2403-2430` |

### How the popular tools do it (BandLab, Soundtrap, FL Studio, Ableton, GarageBand)
- **Cloud save is the baseline** for browser DAWs (BandLab, Soundtrap): free,
  automatic, cross-device, with **version history**. We have none of that (M1-M3).
- **Audio stems + mixdown export** (WAV per track, WAV/MP3 master) — standard.
- **Automation of any knob** with smooth curves — standard in every DAW.
- **Real-time collaboration / invite a collaborator** — BandLab's & Soundtrap's
  headline feature. We have presence (`PresenceProvider`) and `jamSessions` routes
  but no shared project to collaborate *on* — blocked by M1/M2.
- **Loop/sample browser drag-to-timeline**, **templates**, **comping takes**.

### 💡 Missed opportunities
- **Cloud projects unlock half the roadmap**: collaboration, "continue on phone",
  sharing a work-in-progress to SHARE, Astutely working on a saved song.
- **Save as a free hook, not a paywall** — every competitor saves for free;
  gating save is the likeliest reason a free user never returns. Gate storage
  size / project count instead.
- **Organism capture → arrangement** is a unique feature none of the competitors
  have; it's worth making it the front door of MIX.

---

## 2. MAKE — Organism, vocal booth, takes, lyrics

**Layout** (`surfaces/MakeSurface.tsx`): `OrganismCommandCenter` (left) +
`StudioVocalRecorder` "Vocal Booth" + Booth Status (right). How the Organism
*sounds* is out of scope here (ear-tested elsewhere — see memory); this is
about the product loop: perform → keep it → take it somewhere.

### What's strong
- Mic capture is set up right for voice: echo cancel / noise suppression / AGC
  all **off**, no pinned sample rate, shared `AudioContext`, count-in, latency
  offset, input monitoring.
- The Organism take recorder captures **beat + vocal as separate blobs** —
  exactly the raw material for a mixed song.
- MIDI capture writes to a **persisted global store** (`useStudioStore`) — the
  right pattern; it survives surface switches.

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| K1 | 🔴 | **Takes and captures never reach MIX.** Both "Send to arrangement" (`organism:take-ready`) and session capture (`organism:snapshot-ready`) are delivered by window **events**; the only listeners live in `UnifiedStudioWorkspace` (MIX), which `StudioShell` **unmounts** while you're on MAKE — and the Organism only mounts on MAKE. Events fire into nothing, no error, no toast. Capture data does sit in the store, but nothing reads `getActiveSnapshot()` on MIX mount. | `OrganismCommandCenter.tsx:427`, `OrganismProvider.tsx:2534`, `organismToStudioBridge.ts:193`, listeners `UnifiedStudioWorkspace.tsx:1585,1640`, `StudioShell.tsx:154` |
| K2 | 🔴 | **Switching surface wipes every booth take.** Takes live in component `useState`; `StudioShell` renders surfaces with a `switch`, so leaving MAKE unmounts it. No warning. | `MakeSurface.tsx:37`, `StudioVocalRecorder.tsx` |
| K3 | 🟠 | **Send to arrangement drops your vocal.** The Organism take has `vocalUrl`, but the handler only forwards the beat `audioUrl`. | `OrganismCommandCenter.tsx:427-431` |
| K4 | 🟠 | **Two recorders on one screen (a "double").** Vocal Booth (`StudioVocalRecorder`: count-in, latency, monitor — but can only *download*) vs the Organism take recorder (beat+vocal, can send). Neither does the whole job. | `MakeSurface.tsx:145`, `OrganismCommandCenter.tsx:406` |
| K5 | 🟠 | **`/lyric-lab` redirects to MAKE, which has no lyrics.** Lyric Lab is only mounted inside MIX. CLAUDE.md says MAKE is its primary home. | `App.tsx:406`, `UnifiedStudioWorkspace.tsx:4528` |
| K6 | 🟡 | Booth "Download" gives the dry vocal alone — no way to get beat + vocal as one file from MAKE. | `StudioVocalRecorder.tsx:576` |
| K7 | 🟡 | All takes are `blob:` URLs (same as M4) — even if K1 is fixed they die on reload unless uploaded. | `OrganismCommandCenter.tsx:418-419` |

### How the popular tools do it (Rapchat, Voloco, BandLab, Smule)
- **Record over a beat → instantly a finished, mixed song** (vocal preset applied,
  beat + vocal bounced) → **one-tap share**. That loop is the whole product for
  rap/vocal apps.
- **Vocal presets / auto-pitch** on the take (Voloco, BandLab AutoPitch) —
  reverb, EQ, compression, tuning in one tap.
- **Lyrics on screen while you record** (teleprompter) + rhyme help.
- **Punch-in / pick the best take / comp** — standard in BandLab.

### 💡 Missed opportunities
- **Nobody else has a band that follows your voice.** The Organism is the moat —
  but the loop *after* the performance (keep it, mix it, share it) is broken by
  K1-K3, so the moat never turns into a song.
- **One "Keep this" button**: take = beat stem + vocal stem + MIDI capture,
  uploaded, landed in MIX as 3 tracks, playable from SHARE. Every piece exists
  except the plumbing.
- **Lyrics beside the booth** (Lyric Lab already exists; it's on the wrong surface).

---

## 3. ASTUTELY — the AI cockpit

**Layout** (`surfaces/AstutelySurface.tsx`): Copilot sidebar (`AIAssistant`) +
tabs Brain · Generate (loop, bass, vocal melody) · Arrange · Mix/Master
(`AIMasteringCard` + `AIStemSeparation`) · Tools (`AudioToolsPage`) · Codebeat.

### What's strong
- **Stem separation** lands stems as real tracks via `useTracks().addTrack` —
  the one Astutely tool whose output survives leaving the surface.
- **Real auto-master exists** (`POST /api/songs/auto-master`, credit-metered,
  returns an MP3) — mounted correctly after the routes split.
- **Loop generator** uses a mailbox: `localStorage['astutely-generated']`, read by
  the piano roll on mount (≤5 min) — so it *does* reach MIX.

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| A1 | 🔴 | **Bass line "Sent to Piano Roll" goes nowhere.** Event-only (`astutely:generated` + `navigateToTab`); every listener is inside MIX, unmounted on this surface. The toast still says it worked and the page doesn't move. Same root cause as K1. | `AIBassGenerator.tsx:347-356` |
| A2 | 🟠 | **"Apply full arrangement" does nothing but reports success** ("N sections applied to M tracks"). Surface doesn't pass `onApplyArrangement`; `arrangement:applyFull` / `applySection` events have **zero** listeners anywhere. | `AIArrangementBuilder.tsx:163-178`, `AstutelySurface.tsx:310` |
| A3 | 🟠 | **Arranger doesn't arrange.** "Apply section" mutes/sets volume on whole tracks project-wide — nothing is placed on the timeline over bars, so a song shape can't be built from it. | `AstutelySurface.tsx:314-318` |
| A4 | 🟠 | **Generated vocal melody is a dead end.** "Add to Piano Roll" only renders when `onApplyMelody` is passed; the surface doesn't pass it, so the button never appears. | `AIVocalMelody.tsx:283`, `AstutelySurface.tsx:303` |
| A5 | 🟠 | **"Master" doesn't master.** The Master button / Mix-Master tab open `AIMasteringCard`: sends live meter numbers (not audio) to an LLM for text advice; with nothing playing the server substitutes invented defaults (`peakLevel \|\| -3`, `rmsLevel \|\| -12`). Real mastering is hidden in **Tools**. | `AIMasteringCard.tsx:69`, `mixing.ts:245-262`, `AstutelySurface.tsx:179` |
| A6 | 🟡 | **Three assistants, two chat backends (a "double").** Cockpit sidebar mounts `AIAssistant` (`/api/assistant/chat`, 4 action hooks); `AstutelyChatbot` — the one CLAUDE.md names as Astutely — uses `/api/ai/chat` and can generate lyrics/melody/songs (24 action hooks); `FloatingAIAssistant` is a third. The cockpit shows the weakest. | `AstutelySurface.tsx:204` |
| A7 | 🟡 | Loop mailbox holds only the **latest** loop and expires after 5 min — generate three, go to MIX, get one. | `AILoopGenerator.tsx:231`, `VerticalPianoRoll.tsx:914` |
| A8 | 🟡 | Commit `3e905111` ("real auto-master endpoint") contains no server change — the endpoint arrived with the routes split. History is misleading, code is fine. | git |

### How the popular tools do it (Suno, Udio, LANDR, BandLab, iZotope)
- **Suno/Udio**: prompt → full song with vocals in one step; extend / remix /
  replace section; **stems download**.
- **LANDR / BandLab Mastering**: upload or bounce → **mastered file back** with
  style presets (warm/balanced/open) + loudness target + **A/B preview**. Never advice-only.
- **BandLab SongStarter**: AI idea → it's **in your project as tracks**, immediately editable.
- **iZotope Neutron/Ozone "assistant"**: listens to the *actual audio* and sets
  real plugin moves you can tweak — advice is attached to knobs, not paragraphs.

### 💡 Missed opportunities
- **"Master my song" one button**: bounce the arrangement (`bounceMaster` exists)
  → `/api/songs/auto-master` → A/B player → "use this". All parts exist; they're
  on different tabs.
- **AI output → tracks, always.** One shared "send to project" path (TrackStore,
  like stem separation already does) instead of events — fixes A1/A4/A7 and K1.
- **Arranger that writes the timeline**: the AI already returns sections with
  `startBar`/`endBar` + per-track states — that's enough to lay out clips.
- **The Organism + Astutely pairing** (a live band + an AI producer that edits what
  it played) is unique; nobody else has both halves.

---

## 4. LIBRARY — samples, packs, "my stuff"

**Layout**: the LIBRARY surface mounts only `pages/sample-library.tsx` — a
search + category grid over the stock catalog (`GET /api/sample-library` →
`audio/samples/index.json`), with ▶ preview and ＋ add. CLAUDE.md says Song
Uploader and saved beats/projects live here too — **they don't**.

### What's strong
- Real catalog shipped in git (1,519 WAVs), served by our own route; preview
  works (the `window.Audio` kill-switch patch only *tracks* elements).
- `/api/melodies` is a correct per-user backend (auth + list + create).
- Generated packs persist audio properly since the Aug 19-20 Replicate fixes.

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| L1 | 🟡 | ~~No auth on `POST /api/packs/save`~~ **Retracted** — the route has no route-level `requireAuth()`, but the global `requireAuthExcept` gate (`server/index.ts:426`) covers it (`/api/packs` isn't allowlisted). Real issue is L3: the handler never records `req.userId`. | `server/routes/library.ts:44` |
| L2 | 🟠 | **＋ "Add sample" does nothing.** Fires `sample-library:add-sample` + writes `sessionStorage.pendingSamples`; **nothing** listens to or reads either. Toast says "ready to use in studio". | `pages/sample-library.tsx:133-163` |
| L3 | 🟠 | **Saved packs are write-only.** `sample_packs` has **no user column** and there is **no list endpoint** — "Saved to library" packs can never be found again, by anyone. | `shared/schema.ts:277`, `library.ts:44` |
| L4 | 🟠 | **No "my stuff" anywhere in LIBRARY.** Uploaded songs (`/api/songs`) are listed in 6 other places (Song Uploader in MIX, 2 assistants, Multitrack, Playlist Manager, dashboard) but not here. Saved melodies have a working API that **no client calls**. | `StudioShell.tsx:178`, `library.ts:10-28` |
| L5 | 🟡 | **20% of the catalog is dead.** `index.json` lists 1,896 samples; 378 files don't exist — macOS AppleDouble junk (`kick_._e808_bd[long]-01.wav`) that was deleted without regenerating the index. Previews of those fail. | `audio/samples/index.json` |
| L6 | 🟡 | **46% of samples are "other"** (880/1,896) — category browse is mostly one bucket. No BPM/key metadata on anything. | `index.json` |
| L7 | 🟡 | Renders all ~1,900 cards at once, no paging/virtualization; one preview at a time via `new Audio()` (not routed through the shared `AudioContext`, so not in project tempo/key). | `sample-library.tsx:263` |
| L8 | 🟡 | **Four library-ish backends** (`/api/samples`, `/api/sample-library`, `/api/loops`, `/api/packs`) plus a `LoopLibrary` buried in Beat Lab — a "double" to consolidate. | `server/routes.ts:76-127` |

### How the popular tools do it (Splice, BandLab Sounds, Loopcloud, FL browser)
- **Filter by BPM, key, instrument, genre, one-shot vs loop**; **waveform** on every row.
- **Preview in your project's tempo and key** (Splice, Loopcloud) — hear it *in* the song.
- **Drag straight onto the timeline** / one-click "add as track".
- **"Similar sounds"** search from any sample.
- **One "My Library"**: likes, uploads, recordings, generated stuff — all in one place.

### 💡 Missed opportunities
- **We own audio analysis** (WebEar / `audioAnalysis` routes): run it over the
  catalog once → real BPM/key/instrument tags, kill the "other" bucket, and power
  "similar sounds". Splice charges for exactly that.
- **"My Library" = takes + captures + uploads + packs + melodies**, all already
  stored or storable — it's the natural home for the MAKE "Keep this" output (K1).
- **Add-to-project via TrackStore** — the same single "send to project" path
  proposed in part 3 fixes L2 for free.

---

## 5. SHARE — Social Hub, public songs, lyric video

**Layout** (`surfaces/ShareSurface.tsx`): two tabs — Social Hub
(`pages/social-hub.tsx`, 1.4k lines) and Lyric Video Maker. Public song page
`/s/:id` (`pages/public-song.tsx`). Backend: 28 routes in `server/routes/social.ts`
(feed, posts, follow, DMs, discover, collab invites, platform connects).

### What's strong
- **Auth is sound**: global `requireAuthExcept` gate (`server/index.ts:426`) +
  per-handler `req.userId` checks; only `/api/social/feed/public` is open.
- **Organism session share persists** the audio to `/objects/organism-sessions/`
  (the Railway volume) with BPM/key/DNA, and the feed has a dedicated card.
- **Public song page** uses `navigator.share`; the blog uses real Twitter/Facebook
  intents; internal posting to the CodedSwitch feed works.
- A broad social backend exists (follows, DMs, collab invites) — more than most
  music tools ship.

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| S1 | 🟠 | **"Connect Twitter/Instagram/YouTube" is fake.** Client sends only `{platform}`; server stores a "connection" with no token; UI says "Connected! twitter linked to your account". No OAuth, and nothing ever posts to those platforms. | `social-hub.tsx:390-395`, `social.ts:384-412` |
| S2 | 🟠 | **Quick Share buttons connect instead of share.** "Share Beat / Melody / Project" call `connectMutation.mutate(platform)` — nothing is shared; toast says "Connected!". | `social-hub.tsx:488-491` |
| S3 | 🟠 | **Shared Organism sessions have no link of their own.** `postUrl` is always `/social-hub`; you can't send someone *your freestyle*. | `social.ts:325-328` |
| S4 | 🟠 | **Shared song links look generic.** Only `/codebeat` gets per-page Open Graph tags; `/s/:id` shows the site title + `logo.svg` — and SVG `og:image` doesn't render on X/Facebook/iMessage, so links show **no image**. | `server/index.prod.ts:470-560`, `client/index.html:32` |
| S5 | 🟡 | `share-project` / `collab-invite` reference projects that don't exist server-side (M2); they disagree on ID type (`z.string()` vs `z.number()`) and `share-project` never checks you own the project. | `social.ts:116, 614` |
| S6 | 🟡 | Organism session cards render as a black `<video>` box — `.webm` is matched as video, but sessions are audio-only `.webm`. | `social-hub.tsx:68-69` |
| S7 | 🟡 | Site-wide meta description promises "Free online DAW with **real-time collaboration**" — save is Pro-only (M3) and there's no collaboration. | `client/index.html:28` |

### How the popular tools do it (SoundCloud, BandLab, TikTok/IG, Audiomack)
- **Every track gets a public page + short link** with a rich preview card
  (cover art, title, artist, inline player on X/Discord).
- **Export to vertical video** for TikTok/Reels/Shorts (waveform/lyrics + cover) —
  how music actually spreads now. Direct posting uses each platform's official API.
- **BandLab Fork / remix** — open someone's track as a project and make your own.
- **Plays, likes, comments (timestamped on the waveform)** as the feedback loop.

### 💡 Missed opportunities
- **Lyric Video Maker → TikTok/Reels** is already built and transcodes WebM→MP4
  (`server/routes.ts:120`). Pair it with an Organism session = "freestyle clip"
  in one tap — nobody else can make that clip.
- **Per-session public page** (`/s/organism/:id`) with real OG tags and a
  generated waveform PNG — every share becomes an ad for the Organism.
- **Replace fake connects with honest share intents** (X intent, Facebook sharer,
  `navigator.share`, download-for-TikTok) — no OAuth needed, and nothing lies.
- **"Remix this freestyle"**: a session already stores its DNA (`dna` JSON), which could
  seed the Organism toward the same groove for someone else (unverified how close).

---

## 6. Front door & money — landing, signup, pricing, credits, Stripe

**Funnel**: `/` landing → mostly `/organism` (60s guest demo) → `/signup` →
`/dashboard`. Pricing `/pricing` → `POST /api/credits/membership-checkout`
(subscriptions) or `/purchase-checkout` (credit packs) → Stripe → webhook
(`server/services/stripe.ts`). Credits: `server/services/credits.ts`.
**Prod snapshot (read-only, 2026-10-07): 17 users, 0 with a Stripe subscription;
the one "pro/active" account has no Stripe sub (owner/test).**

### What's strong
- **The webhook is production-grade**: signature verified, **event-ID dedup with
  claim/release**, async payments, invoice paid/failed, full subscription
  lifecycle, and **credit clawback on refunds and disputes**.
- **Checkout validates the Stripe price** (recurring vs one-time, currency) before
  creating a session; tier prices match the page ($9.99 / $29.99 / $79.99).
- **Credit packs match exactly** (100/$4.99, 500/$19.99, 1000/$34.99, 5000/$149.99);
  signup grant = 10, as advertised.
- **Owner/admin auth is careful**: constant-time owner-key compare with a length
  floor; dev auto-login is structurally impossible in production.
- The landing page leads with the **Organism demo** (5 CTAs) — the right hook.

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| F1 | 🔴 | **Subscribers never get monthly credits.** Pricing promises 200 / 750 / 2,500 credits/mo + rollover; `grantMonthlyCredits` is only called by the owner-only admin endpoint — not by the webhook (`checkout.session.completed`, `invoice.paid`) or any scheduler. 0 affected today; **launch blocker** for the first subscriber. | `server/services/stripe.ts:240-289`, `services/credits.ts:244`, `routes/credits.ts:155` |
| F2 | 🟠 | **Page and server disagree on credit amounts.** Creator 200 (page) vs 300 (server); Pro 750 vs 1,000; Free "10 to start" vs a `FREE.monthlyCredits: 50` that's never granted. Whichever wins once F1 is fixed, one of them is lying. | `pricing.tsx:40-80`, `services/credits.ts:15-65` |
| F3 | 🟠 | **Free tier can make but not keep.** Client gates: `save` (M3), `export`, `ai` (the ASTUTELY sidebar copilot), `ai-chords`. A free user can't save, export, or talk to the cockpit assistant; credit-pack buyers who don't subscribe hit the same walls despite having credits. | `LicenseGuard.tsx`, `UnifiedStudioWorkspace.tsx:2492,2532`, `AIAssistant.tsx:273` |
| F4 | 🟠 | **Demo → signup drops momentum.** The guest just played the Organism; signup sends them to `/dashboard`, not back to `/studio/make`. | `signup.tsx:110,242` |
| F5 | 🟡 | **Onboarding is orphaned** — `/onboarding` (243 lines, ends in `/studio`) has a route but no link from anywhere. | `App.tsx:321` |
| F6 | 🟡 | **Five checkout endpoints (a "double")**: `/api/create-checkout`, `/api/create-checkout-session`, `/api/billing/create-checkout-session`, `/api/credits/purchase-checkout`, `/api/credits/membership-checkout`. Pricing uses the last two. | `routes/billing.ts:26-28` |
| F7 | 🟡 | Grant/refund admin checks also accept `req.userId === 'owner-user'` — fine today (only the owner key sets it), but a DB user with that literal id would be admin. | `routes/credits.ts:161,193` |

### How the popular tools do it (BandLab, Splice, Suno, LANDR)
- **BandLab: everything free** (save, export, collab, mastering preview) —
  monetizes via add-ons. **Suno**: free daily credits, paid = more credits +
  commercial rights. **Splice**: subscription = monthly credits that **arrive
  automatically** and roll over.
- The paywall sits on **volume and rights** (credits, storage, commercial use,
  stems/WAV quality), never on *keeping your own work*.
- After signup, users land **back in the thing they were trying** with their
  demo state preserved.

### 💡 Missed opportunities
- **Free daily/monthly credits** (Suno model) — the server already defines a
  FREE tier with `monthlyCredits: 50`; granting it gives free users a reason to
  come back daily.
- **Save free, gate volume** (projects count / storage) and **gate export
  quality** (MP3 free, WAV + stems paid) instead of gating save/export outright.
- **Carry the guest demo into the account**: the demo already captures session
  DNA — hand it to signup so the user's first studio screen *is* their demo groove.

---

## 7. Side tools — vulnerability scanner, Codebeat, voice convert

**Pages**: `/vulnerability-scanner`, `/codebeat` (+ ASTUTELY Codebeat tab),
`/voice-convert`. Prod snapshot (read-only): voice convert **13 done / 13 failed**
(all cloud mode, all by the owner account).

### What's strong
- **Codebeat is clean**: deterministic `analyzeCodeStructure → composeArrangementFromCode`,
  plan validated before returning, rate-limited (`aiLimiter`), no AI cost, safe
  to leave public. It also has the only custom OG preview (`/codebeat-og.png`).
- **Scanners take pasted code only** — no URL fetching, so no SSRF surface.
  `/api/vulnerability/scan` validates input (zod, 50k chars, language enum) and
  stores only the first 1,000 chars.
- **Voice convert is a real async job pipeline** (job table, queue, per-stage
  status, orphan recovery on restart, BYO-keys mode for zero credit cost).

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| T1 | 🟠 | **Failed voice conversions keep the user's credits.** Cloud mode deducts up front; the job queue marks failures (and restart orphans) `failed` with no refund — `refundCredits` is only reachable from the owner admin endpoint. Prod: 50% failure rate so far, all on the owner account, so 0 users harmed *yet*. | `voiceConvert.ts:79-91`, `services/jobQueue.ts:38-41,197` |
| T2 | 🟡 | Job rows record `credits_cost = 0` even when credits were deducted — the refund in T1 has nothing to read the amount from. | `voice_convert_jobs.credits_cost` |
| T3 | 🟠 | **Scanners are free, unlimited AI calls.** Neither scan route has `requireCredits` or `aiLimiter`; only the global 400 req / 15 min cap applies. `/api/security/scan` also has no input size check (10 MB body limit). | `vulnerability.ts:18`, `securityScan.ts:8` |
| T4 | 🟡 | **Two scanners (a "double").** Page → `/api/vulnerability/scan` (validated, saved to history); studio `VulnerabilityScanner` → `/api/security/scan` (unvalidated, client picks `aiProvider`, hard-codes `gpt-4`). | `pages/vulnerability-scanner.tsx:54`, `components/studio/VulnerabilityScanner.tsx:51` |
| T5 | 🟡 | **`POST /api/ai-provider/set` lets any logged-in user write global state** (`aiProviderManager` singleton, no userId). Inert today — nothing reads `getProvider` — but becomes a site-wide switch the moment anyone wires it up. No UI calls it. | `routes/aiOps.ts:89`, `services/aiProviderManager.ts:109-168` |

### How the popular tools do it
- **Scanners (Snyk, Semgrep, GitHub CodeQL)**: rule-based static analysis +
  repo/PR integration; AI is used to *explain/fix* findings, not to find them.
  Pasted-snippet LLM scanning is a demo, not a product.
- **Voice (Kits.ai, Voice-Swap, ElevenLabs)**: **credits are only consumed on
  success** (or auto-refunded on failure), with a free short preview first.
- **Code → music** has no real competitor — Codebeat is novel.

### 💡 Missed opportunities
- **Codebeat is the most shareable thing in the app** ("what does your code
  sound like?") and already has a public page + OG card. A "paste a GitHub file
  → shareable clip" loop is a developer-audience growth channel nobody else has.
- **Voice convert + MAKE booth**: convert a freestyle take into another voice
  right where it was recorded (the pipeline already takes a `sourceUrl`).
- **Scanner focus**: it's far from the music core. Either fold it into Codebeat's
  developer story or drop it — two half-maintained scanners cost more than one.

---

## 8. Server & infrastructure

**Build**: `esbuild.config.js` bundles **`server/index.prod.ts`** → `dist/index.cjs`
(Railway runs that). `server/index.ts` is dev-only (`npm run dev`).
**Baseline 2026-10-07**: `npm run check` clean; `npm run test:unit` **136 files /
1,075 tests pass**. Live `/api/health` → 200.

### What's strong
- **Routes split (`4fe75157`) is clean**: resolved all 46 mounts / 275 routes —
  **no METHOD+path defined in two files** (only the deliberate `/api/songs` +
  `/api` back-compat alias).
- **Entrypoints are now well aligned**: app-level `use/get` differ only where
  they should (prod serves the SPA + `/codebeat` OG; dev has Vite + a static
  `/api/samples`). Auth allowlists differ only by `/api/audio-debug` (dev, by
  design) and `/api/reference-beats` + `/api/sample-profiles` (prod; redundant,
  both are static mounts ahead of auth).
- Reference beats (third-party "type beats") are gitignored → absent from the
  Railway build → the static mount is skipped in prod. ✔
- Global auth gate, 400/15 min limiter, 10 MB body cap, helmet, PG sessions.

### Findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| D1 | 🔴 | **The public blog is broken in production.** `blog_posts` table doesn't exist; live `GET /api/blog/posts` → **500 "Failed to fetch blog posts"**. The blog page has no fallback → empty blog (SEO/landing links). `runMigrations` never creates it. | `server/routes/blog.ts:14`, `pages/blog.tsx:30` |
| D2 | 🟠 | **Jam tables have the old shape in prod.** 13 columns in `schema.ts` (`host_id`, `name`, `is_public`, `audio_url`…) don't exist; prod has an older design (`title`, `visibility`, `content_type`). `runMigrations` has the *new* DDL but uses `CREATE TABLE IF NOT EXISTS`, which skipped the existing table. 0 rows, so safe to recreate. | `server/migrations/runMigrations.ts:225-270` |
| D3 | 🟠 | **Root cause of every drift incident (Jul Social Hub, D1, D2): two schema sources.** Drizzle `shared/schema.ts` vs hand-written `runMigrations` SQL, and `IF NOT EXISTS` can never evolve a table. Nothing detects the gap. | `shared/schema.ts`, `runMigrations.ts` |
| D4 | 🟡 | Unknown paths under a *public* prefix (e.g. `GET /api/blog`) fall through to the SPA → **HTML with 200** instead of a JSON 404; clients parse HTML as success. | `server/index.prod.ts` `app.use("*")` |
| D5 | 🟡 | Stale line refs in the allowlist comment (`index.prod.ts:108` → mount is now at 205). | `index.prod.ts:395-399` |

### 💡 Missed opportunities
- **A schema drift check** (compare `schema.ts` tables/columns to
  `information_schema`, read-only) at boot or in CI — the script used for this
  review found D1/D2 in one query. It would have caught all three incidents.
- **One migration source**: generate SQL from `schema.ts` (`drizzle-kit generate`)
  and apply it non-interactively, instead of hand-mirrored DDL.

---

# Ranked fix list (all 8 parts)

Ranked by: loses user work / money or breaks a promise > makes a feature lie >
duplicates & cleanup. "≈" = same root cause, fix together.

## Tier 1 — work loss, money, launch blockers
1. **F1** Subscriptions never grant monthly credits → grant on `invoice.paid`
   (`billing_reason` create/cycle) + decide F2's numbers. *Launch blocker.*
2. **M1 · M2 · M3** Cloud projects: build `/api/projects` (table exists), wire
   File→Save/Open + autosave to it, make save free (gate volume instead).
3. **K1 ≈ A1 ≈ A2 ≈ A4 ≈ L2 ≈ M5** One "send to project" path through TrackStore
   (or a mailbox read on MIX mount) — replaces 7 event-only handoffs that drop
   data when MIX is unmounted; toasts fire on *arrival*.
4. **M4 ≈ K7** Upload takes/recordings instead of storing `blob:` URLs.
5. **K2 ≈ K3 ≈ K4** MAKE: takes survive surface switches; Send keeps the vocal;
   merge the two recorders into one "Keep this".
6. **D1** Create `blog_posts` in prod (additive SQL) — public blog is 500ing.
7. **T1 ≈ T2** Refund credits on failed voice jobs; record `credits_cost`.

## Tier 2 — features that say they work but don't
8. **S1 · S2** Replace fake platform "Connect"/Quick Share with real share intents.
9. **A5** "Master" → real `/api/songs/auto-master` (bounce → master → A/B).
10. **M6 · M7 · M8** Automation: apply all offered params via AudioParam ramps;
    "Export stems" → per-track WAV.
11. **K5** `/lyric-lab` → somewhere Lyric Lab actually is (or put it on MAKE).
12. **F3 · F4 · F5** Free tier & funnel: un-gate save, signup → back to the
    Organism, link onboarding.
13. **T3** Scanners: `aiLimiter` + credits + input cap.
14. **L3 · L4** Packs get an owner + list endpoint; "My Library" view.
15. **S3 · S4** Per-session/per-song public pages with real OG (PNG) cards.
16. **A3** Arranger writes clips to the timeline.
17. **D2 · D3** Recreate jam tables; add the drift check.

## Tier 3 — doubles & cleanup
18. Two timelines (M9), two automation systems (M10), three assistants (A6),
    two scanners (T4), five checkout endpoints (F6), four library backends (L8).
19. **L5 · L6** Regenerate the sample index (drop 378 dead entries); tag with WebEar.
20. **T5** Delete `/api/ai-provider/set`; **F7** drop the `'owner-user'` literal check.
21. M11, M12, A7, A8, S5, S6, S7, D4, D5, L7 — small edges.

---

# Target vs. Shipped

Every fix states the **best-practice target** first. If what shipped is less,
the gap goes here **and becomes a ranked item** in the fix list above — a gap is
deferred work, not an archive. Nothing counts as shipped until it is
**verified the right way**: unit test (logic), clicked through in the running
app (UI / wiring), or the user's ear (anything about how music sounds).

| Item | Target (best way) | Shipped | Gap → why deferred | Verified how |
|---|---|---|---|---|
| **F1** Monthly credits | Grant on `invoice.paid` (create + cycle), once per invoice; tested against a real Stripe test-mode subscription | Same, deduped per invoice id in the ledger (`aa2137a5`) | End-to-end Stripe test-mode run not done → needs Stripe test keys + a webhook tunnel | 5 webhook unit tests |
| **F2** Tier numbers | One source for page + server | `shared/membershipTiers.ts`; honest feature lists | — | tsc; page not yet viewed in browser |
| Credits rollover | Business decision: cap or uncapped | Uncapped, stated honestly ("unused credits roll over") | A cap is a pricing call for the owner, not a best-practice fix | — |
| **M1–M3** Cloud save | Conflict check (`updatedAt` / If-Match) so two tabs can't silently overwrite; version history with restore; save shortly after edits (debounced); per-account quota | Whole-snapshot JSON, last write wins, manual save + 30s autosave when changed, free for all (`01e5ec7d`) | Conflicts, history, quota → each its own change; cloud save had to exist first | 7 route tests + **browser**: Ctrl+S saves, repeat save updates in place, Ctrl+O lists it (Playwright, in-memory server) |
| Export Audio | Offline render of *all* tracks (audio + instruments) to one WAV, plus per-track stems | Audio tracks → WAV; instrument tracks → MIDI, toast says so | Instruments need an offline render graph (`Tone.Offline` + the realisticAudio voices) → its own build | tsc only; **browser pass pending** |
| **K1/A1/A4/L2** Cross-surface sends | One delivery path that works when MIX is unmounted, survives reload, confirms on arrival | Persisted project inbox, drained by MIX; MIX's importer toasts on arrival | ≈ target. Producers could write TrackStore directly, but OrganismProvider sits outside the studio and the inbox also survives reload. Keeping all surfaces mounted is **not** better (two engines on one clock) | inbox unit tests + **browser**: LIBRARY ＋ queues while MIX is closed, MIX imports on open, inbox drains |
| **M4/K7** Recordings & takes | Audio stored as asset records (owner, size, quota, cleanup when a project is deleted) | Uploaded through the existing `/api/objects/upload` flow; raw URL kept on the track | No asset table → orphaned files on delete, no quota → own change | **browser**: booth take (fake mic) survives MAKE→MIX→MAKE; + MIX uploads and sends it |
| **K2/K4** MAKE takes | One recorder: vocal over the band, count-in/latency, takes kept across navigation, a single **Keep** that sends beat + vocal + MIDI capture | Booth takes in a session store (survive surface switches); **+ MIX** per booth take; Organism **+ DAW** uploads + sends beat AND vocal | Two recorders still side by side (merge is a UX redesign); session store isn't reload-proof until a take is kept | **browser** (booth); Organism send: tsc only |
| **D1–D3** Schema drift | One migration source generated from `schema.ts`, applied on every boot, plus a drift check that fails loudly | **Production now runs `runMigrations()` at boot** (only the dev entrypoint ever did — the real root cause); `blog_posts` added | Two sources still (schema.ts + hand DDL); a failing statement still skips the rest silently; jam_* old shape needs a one-off recreate | prod bundle builds; tables verified by the read-only drift query after deploy |
| Blog publishing | Owner-only writes to the official blog | Owner-only `POST /api/blog/posts` (was: any signed-in user, `isPublished: true` honoured) | Blog is empty until the owner writes posts | 2 route tests |
| Toasts | Confirmations never lost; system notices don't compete with them | `TOAST_LIMIT` 1 → 3; dropped the "Audio System Ready" success toast that replaced the user's first confirmation | — | **browser**: LIBRARY "Sent to MIX" now visible |
| Transport-bar recording | Recording lands where it was recorded, survives reload | Uploaded, then into the project at its start bar (was dropped: wrote to a `currentProject` nothing set) | — | tsc |
| Shared-browser isolation | All browser-persisted studio state scoped to the signed-in account | Inbox, open cloud project and booth takes cleared on sign-out or when a different user signs in (`/api/subscription-status` now returns `userId`) | Other per-browser stores (e.g. Organism snapshots, autosave checkpoints) are notes/arrangement data, not uploads — same treatment later | 3 unit tests + **browser**: A queues → B signs in → nothing imported |
| **T1/T2** Failed voice jobs | Credits reserved and only committed on success — or refunded automatically, exactly once, on any failure | Cost recorded on the job (`creditsCost` was missing from the insert schema, so it was always 0); both failure paths (run error, restart orphan) refund it once, deduped per job in the ledger | Reserve-then-commit would also cover a crash *between* deduct and job insert → own change | 3 unit tests |
| **S1/S2** Platform sharing | Real posting to X / Instagram / YouTube / TikTok via each platform's OAuth app | Honest **Share** tab: pick a song → made public → X intent, Facebook sharer, device share sheet, copy link (`/s/:id`); fake Connect cards, Quick Share, the "connected platforms" panel and the token-less `/api/social/connect*` endpoints removed | Direct posting needs OAuth apps registered with each platform (owner action) | **browser**: no Connect buttons; copy link yields `/s/<id>`, public page API 200 |
| **A5** Mastering | "Master my song": bounce the arrangement → real master → A/B → add to project; advice only from measured audio | **Master my song** panel (ASTUTELY → Mix/Master): bounce (shared `lib/bounceProject`) → upload → `/api/songs/auto-master` → A/B players → Add to project / Download MP3. "AI Mix Advice" label; server refuses advice without real, non-silent levels; stem pipeline's guidance-from-hard-coded-levels removed; Tools master downloads as `.mp3` | Instrument tracks aren't in the bounce (same offline-render gap as Export Audio); mastering presets (warm/open) and a loudness readout | **browser**: bounce + upload + A/B "Your mix" player; mastering function produced a valid MP3 from that exact upload (the Windows dev server couldn't spawn ffmpeg — env quirk; prod image has ffmpeg) |
| **M6/M8** Automation | Every offered parameter audible, scheduled ahead as AudioParam ramps from the lane points | Dropdown trimmed to what the engine can set (volume, pan, reverb/delay send, EQ low/mid/high — 7 unsupported params removed); all lanes applied via `resolveAutomationParam`; engine setters glide (`setTargetAtTime`, 15 ms) instead of jumping, EQ getter returns the target | Values still pushed per playhead tick (glided) rather than pre-scheduled from the curve; filter/drive/comp need per-channel insert effects in the engine | 3 unit tests; **ear pending** (does a fast fade still zipper?) |
| **M7** Export stems | One WAV per track (instruments rendered too), one zip | Zip of one WAV per audio track (rendered with its volume/pan/offset, `fflate`) + one MIDI per note track; numbered, safe names; feedback when empty/failed | Instrument tracks as MIDI until offline instrument render exists | 3 unit tests + **browser**: downloaded zip contains a 480 KB RIFF WAV |
| **K5** Lyrics on MAKE | Lyrics visible while you record (teleprompter beside the booth, following the take) | Collapsible **Lyrics** panel on MAKE (the existing Lyric Lab); `/lyric-lab` opens it expanded | Panel sits under the band rather than beside the booth; no follow-along/teleprompter mode | **browser**: `/lyric-lab` → MAKE with Lyric Lab open, no page errors |
| **F4/F5** Funnel | Every sign-in returns you where you were; new accounts land in the product's hook | Validated `?next=` (same-site paths only — no open redirect) through the login gate, login and signup; signup defaults to MAKE (the Organism). **Found + fixed:** signup never seeded the auth cache, so ProtectedRoute bounced every brand-new account to /login — one shared `useCompleteSignIn` for login + signup (email and Google) | Onboarding answers are discarded server-side — use them (seed the Organism's genre) or remove the page | 2 unit tests + **browser**: deep link → login → back; signup → /studio/make |
| CI | CI green on every push; production built from the exact lock CI verified | Lock regenerated with npm 10 (CI was red since Aug 29); dangling submodule removed; pre-push hook blocks a lock npm 10 rejects | Dockerfile still `npm install` → should be `npm ci` | `npx npm@10 ci --dry-run` passes; CI run on push |
| **T3/T4** Code scanner | One scanner: rule-based analysis + AI explanation, rate-limited, charged on success | Single scanner (`/api/vulnerability/scan`, patterns + one AI pass) behind `aiLimiter` + `requireCredits(CODE_SCAN = 2)`, charged after success; duplicate `/api/security/scan` + its unmounted component deleted | Price (2 credits) is a placeholder matching lyrics analysis — owner's call | 2 route tests |
| **D2/D3** Jam tables + drift guard | One migration source generated from schema.ts; drift fails the deploy | Guarded rebuild of jam_* (only if still old-shape AND empty — checked at run time); boot-time `checkSchemaDrift` logs every missing table/column after migrations (dev + prod) | Still two schema sources; drift is logged, not deploy-blocking | 2 unit tests; prod drift query after deploy |
| **L3** Saved packs | Every pack owned, listable, reopenable on any device; "My Library" for all user content | `sample_packs.user_id` + `meta` (bpm/key/generator/title), both writers record the owner, `GET /api/packs/mine`, Pack Generator's Archive shows account packs first (deduped with browser history) | The 16 packs saved before today have no owner (unknowable); a unified "My Library" (L4) is still to build | 1 route test; **browser pending** for the Archive list |
| **S3/S4/S7** Share pages & cards | Every shared song/session: own public page, rich card (per-item image, inline player) | Default card fixed (`/og-image.jpg` never existed — every link had no image; now `og-image.png` rendered from the existing `og.html` brand card, 1200×630); `/s/:id` gets "Song — Artist" title/description server-side; new public `/p/:id` page per Organism session (player, caption, "Jam with the Organism") with its own card; share confirmation links to it; "real-time collaboration" claim removed from site metadata | Per-item artwork (waveform/cover image) and an inline player card (`twitter:player`/`og:audio`) | 3 + 2 tests; live check after deploy |
| **A2/A3** Arranger | Applying an arrangement lays the song out on the timeline (clips per section) | "Apply full arrangement" writes the sections as stepped volume automation on every project track (TrackStore), audible on playback and editable in MIX → Arrangement — one implementation inside the builder, so all 3 mounts (ASTUTELY + 2 in MIX) work; dead `arrangement:apply*` events removed | Clip-level layout (moving/duplicating clips per section) instead of volume gating | 3 unit tests; **browser pending** (needs a live AI arrangement) |
| **M5/M10** Pop-out windows | Each tool exists once and works | Removed 4 windows that opened empty AND duplicated working tools (Automation → Arrangement lanes; Clip Editor → Arrangement; MIDI Editor → Piano Roll; Effects Chain → per-track effects dialog) + the orphaned automation engine; Sample Slicer kept (it works standalone) — Export is now one zip, new **Send to MIX** uploads slices as tracks; Project Manager fixed earlier (#2) | — | tsc + full suite; slicer send **browser pending** |
| **F6** Checkout | One way to buy | In-app Upgrade → /pricing (validated membership checkout); 3 legacy aliases + handler + helper removed | — | full suite |
| **A6** Assistants | One assistant everywhere, cost-controlled | Astutely (`AstutelyChatbot`, embedded) is now the cockpit sidebar, MIX's AI-studio view and /ai-assistant; the weaker `AIAssistant` + disabled `FloatingAIAssistant` + `/api/assistant/chat` removed; `/api/ai/chat` gets `aiLimiter` + a 20-message / 4,000-char cap (it had neither); "Astutely copilot chat" dropped from the paid list (it's open to all via ⌘K); embedded mode hides the resize handle; "Neural Link Active" → "Online" | Per-message credit charging is a pricing call (owner); sidebar layout polish (first message clipped, panel not full height) | **browser**: cockpit + /ai-assistant show Astutely, no page errors |
| **L8** Library backends | One sample source, one way to add a sample | Reviewed: `/api/samples` + `/api/sample-library` read the SAME service (two response shapes, no drift); loops + packs are different content — not data doubles. The real double was 3 sample BROWSERS, two of which didn't add samples (MIX sidebar only toasted "Selected"; the Sample Library window fired an event only the Multitrack view hears) — both now add via the project inbox | Merge the 3 browser UIs into one component | tsc + suite; **browser pending** |
| Collaboration (S7) | Real-time co-editing (CRDT, e.g. Yjs) on cloud projects | Not built — the site copy claiming it must change | Large; cloud projects (its precondition) now exist | — |
| `noteToMidi` flats | Correct enharmonic mapping | Db→C#, Eb→D#… (was 2 semitones sharp) | — | unit test |
