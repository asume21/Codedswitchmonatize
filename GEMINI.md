# GEMINI — READ THIS BEFORE TOUCHING ANYTHING (CodedSwitch:Astute hybrid)

You are continuing a carefully-scoped project. Previously you built real, useful
work **in the wrong place** — directly in `main`'s working tree of the production
repo — which is exactly what this project must never do. This file exists so that
does not happen again. Follow it literally.

---

## 🛑 THE NON-NEGOTIABLE RULES (you broke these before)

1. **NEVER build hybrid/bridge code in `main`'s working tree.** All web-side
   desktop-bridge work lives ONLY on the branch **`astute/stage2-web-bridge`**.
   Run `git checkout astute/stage2-web-bridge` BEFORE editing any bridge file.
   If `git rev-parse --abbrev-ref HEAD` says `main`, STOP and switch.

2. **Railway auto-deploys from `origin/main`.** Never commit or push bridge work
   to `main`. A commit to `main` = a production deploy. Keep `main` clean.

3. **The Python engine is a SEPARATE local repo:** `D:\Codedswitch-Astute`
   (local only, NO git remote, do not create one). Do NOT merge it into the web
   app. The website and the desktop engine are two separate artifacts that talk
   over a localhost WebSocket — they are never one build.

4. **ONE BRAIN.** The web app's Organism is the ONLY thing that composes music.
   The Python engine is OUTPUT ONLY — it plays note events it is sent; it never
   decides notes. Do not create a second engine, second clock, or second
   "brain." Duplicate/competing systems ("the doubles") are this project's #1
   recurring failure. If you find yourself re-implementing musical logic on the
   Python side, STOP.

5. **Flag-gate everything.** The bridge is gated behind
   `VITE_ENABLE_DESKTOP_BRIDGE` (default **false** in `.env.example`). Never make
   it always-on. Default OFF, opt-in only.

6. **Stay in the current stage. Do not jump ahead.**
   - ✅ Stage 1 (prove the seam) — DONE, passed.
   - ▶ Stage 2 (now) — stream the REAL Organism's events to the engine + A/B
     fidelity test.
   - ❌ Do NOT build: native/ASIO/VST engine, Electron/Tauri, an installer, or
     live mic/MIDI input. Those are Stage 3/4 and are OUT OF SCOPE now.

7. **Read the spec and plans before building:** in `D:\Codedswitch-Astute\docs\`
   (`2026-06-23-bridge-proof-design.md`, `plans/2026-06-23-engine-and-seam-proof.md`).
   Extend the existing design; do not write a new competing spec.

---

## WHERE THINGS STAND (2026-06-23)

**Stage 1 — DONE and PROVEN.**
- Python engine repo: `D:\Codedswitch-Astute` (local, no remote). 7 commits
  `b6f464e..7b8ba1b`, **14 tests pass.**
- Files: `src/astute_bridge/{clock,scheduler,player,server}.py`, `run_bridge.py`,
  `webtest/` (browser test page), `assets/*.wav` (drums + upright piano samples).
- Result: a 60-second beat streamed browser→engine played in time —
  **661 events, 5.65 ms median jitter** (gate was < 10 ms). M1 + M2-timing PASS.
- How to run it: see `D:\Codedswitch-Astute\VERIFY.md` (PowerShell:
  `$env:PYTHONPATH="src"; python run_bridge.py`, then serve `webtest/`).

**Stage 2 web integration — EXISTS BUT UNVETTED, on a branch.**
- Your earlier desktop-bridge work was moved OFF `main` onto branch
  **`astute/stage2-web-bridge`** (commit `d09fdeed`). It is flag-gated
  (default off) but has NOT been reviewed or tested end-to-end.
- Files on that branch: `client/src/lib/desktopBridge.ts`,
  `client/src/lib/bridgeExporter.ts`,
  `client/src/contexts/DesktopBridgeContext.tsx`,
  `client/src/components/studio/DesktopBridgeToggle.tsx`, plus small edits to
  `App.tsx`, `Header.tsx`, `MasterMultiTrackPlayer.tsx`, `use-audio.ts`,
  `audioEngine.ts`, `realisticAudio.ts`, and `.env.example`.

**`main` is clean and production-safe.** No bridge code on it.

---

## YOUR NEXT STEPS (Stage 2), in order

1. `git checkout astute/stage2-web-bridge` (NEVER do this work on `main`).
2. **Review your own bridge code** for correctness — confirm it is genuinely
   default-OFF, connects only when `VITE_ENABLE_DESKTOP_BRIDGE=true` and the
   toggle is on, and that it does NOT duplicate or fight the existing audio
   engine (one brain). Build must pass (`npm run check`, `npm run build`).
3. **M2-real:** start the Python engine (`D:\Codedswitch-Astute`, see VERIFY.md),
   run the web app (`npm run dev`), enable the Desktop Output toggle, play the
   Organism, and confirm real note/drum events stream to the engine and play
   with median jitter < 10 ms.
4. **M3 (fidelity A/B):** toggle Desktop Output OFF (hear browser soundfonts) vs
   ON (hear the local engine's real WAV samples). Confirm the local output
   sounds better and the browser output is silenced while ON.
5. Record results in `D:\Codedswitch-Astute\VERIFY.md`. Commit web changes to the
   **branch only**. Commit engine changes (if any) in the Astute repo.

## Deferred (do NOT do now — write down, don't build)
- WebSocket Origin allow-list + shared-secret handshake (Cross-Site WebSocket
  Hijacking protection) — required before this ships as a download, Stage 3.
- Replacing pygame with a native low-latency/VST engine — Stage 3. pygame is the
  proof engine only.

---

*Authored as a handoff for Gemini by the Claude session that built Stage 1.
If anything here conflicts with what the user tells you, the user wins — but
ask before building in `main` or merging the repos.*
