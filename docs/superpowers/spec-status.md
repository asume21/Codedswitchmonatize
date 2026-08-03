# Spec Completion Ledger

**Goal (2026-07-28):** every spec is either **FINISHED** or **KILLED** — finished preferably.
No more 80%-done specs lying around; a half-built system is what breeds the "doubles."

**Ordering rule:** impact-first. Finish the specs with the biggest effect on the app first.

**Status confidence:** this is a first-pass assessment from code traced this session +
prior verification. A FINISH candidate gets a full code-trace at the moment we start it,
and its "what's left" is confirmed then. KILL candidates are not deep-audited.

Legend — Verdict: ✅ done · 🎯 FINISH · ✂️ KILL · 🔗 MERGE.
Impact: how much finishing it improves the actual app (music quality / growth / unblocks).

---

## Ranked shortlist (impact-first)

| # | Spec | Impact | Status | Verdict | Effort |
|---|------|--------|--------|---------|--------|
| 1 | master-duplicate-killlist (06-17) | 🔥🔥🔥 core quality | ongoing | 🎯 FINISH | days |
| 2 | organism-as-playable-instrument (07-11) | 🔥🔥🔥 the live-loop vision | ~20% | 🎯 FINISH | days |
| 3 | freeplay-generators (07-02) | 🔥🔥🔥 fixes "beats too samey" | baseline | 🎯 FINISH | 1–2 days |
| 4 | conductor-directs-the-band (06-18) | 🔥🔥 cohesion | Part 1 done | 🎯 FINISH | days |
| 5 | loop-pack-system (06-24) | 🔥🔥 capture-to-library target | phase 1 | 🎯 FINISH | days |
| 6 | melody-as-melody (06-16) | 🔥🔥 melody fire | voice-leading in | 🎯 FINISH | days |
| 7 | pro-instruments (06-06) | 🔥🔥 real instrument sound | partial | 🎯 FINISH | days |
| 8 | band-rack-and-brains (07-13) | 🔥🔥 solo/mute parity + AI→editor | brains wired | 🎯 FINISH | big |
| 9 | webear-stem-capture (07-10) | 🔥 dev tooling (enables tuning) | bench in | 🎯 FINISH | 1–2 days |
| 10 | codebeat (07-20) | 🔥🔥 growth/funnel | mostly done | 🎯 FINISH | hours |
| 11 | ace-everywhere (06-12) | 🔥 text-to-music | close | 🎯 FINISH | hours |
| 12 | musicmind-harmonic (06-24) | 🔥 harmonic AI | real work in | 🎯 FINISH | days |
| — | google-login (07-03) | — | shipped | ✅ DONE | — |

---

## Per-spec notes

### 1. master-duplicate-killlist (06-17) — 🎯 FINISH · highest impact
The user's own #1 problem: competing/duplicate systems ("doubles that haunt us").
Finishing this raises quality more than any single feature. **Left:** enumerate the
remaining doubles, consolidate to one system each. Overlaps every other organism spec —
finishing #2–#7 *is* partly finishing this.

### 2. organism-as-playable-instrument (07-11) — 🎯 FINISH · the live-loop vision
Only Story Mode (drum groove lock) + always-on grooveLock shipped (~20%). **Left:**
per-role + global Lock/Evolve/Fresh, seamless commit-and-repeat loops, the salt-reroll
variety fix, and Phase 2 capture-to-library. **This is the feature we brainstormed this
session** — the brainstorm IS the design for finishing this spec.

### 3. freeplay-generators (07-02) — 🎯 FINISH · fixes the sameness
The seed/salt/motif system lives here. Root cause of "lo-fi always plays the same beat":
`sessionSalt` only re-rolled on organism START (GeneratorOrchestrator.ts:496), so switching
style and back regenerated an identical beat.
**DONE (2026-07-28, commit 9ff407c9):** the style-change variety trigger — `setSongCellStyle`
now re-rolls the salt on a genuine style change (no-ops when a seed is pinned). Covered by
`songCell.variety.test.ts`. **Left:** the explicit user "Fresh" trigger (ships with the
Lock/Evolve/Fresh slice of #2 — the seed IS the lock/variety dial).

### 4. conductor-directs-the-band (06-18) — 🎯 FINISH
Part 1 (roles) shipped; Part 2 (kill mix-churn) active; Part 3 (voicing/duet) later.
Cohesion backbone. **Left:** Parts 2–3.

### 5. loop-pack-system (06-24) — 🎯 FINISH
Hybrid row switches + Sample Leads shipped; phases 2–4 (chop / glue / user upload) pending.
The **library write path** needed for #2's capture phase lives here. **Left:** upload/write
path + the pending phases.

### 6. melody-as-melody (06-16) — 🎯 FINISH
Voice-leading + lyrical vocabulary shipped; expressive layer (swells/breath/vibrato) next.
**Left:** expressive layer.

### 7. pro-instruments (06-06) — 🎯 FINISH
Real multisamples replacing thin GM soundfonts; ongoing. **Left:** finish the instrument
coverage + expression. (Also where new timbres — synth/whistle/pluck — would land.)

### 8. band-rack-and-brains (07-13) — 🎯 FINISH · big
Claude=composer / Ollama=conductor wired; **Band Rack Part A (generators as real tracks with
solo/mute) unbuilt.** Directly answers the solo/mute parity gap found this session. Big effort.

### 9. webear-stem-capture (07-10) — 🎯 FINISH
Capture bench shipped; the 4 WebEar tools (diff_audio, groove_score, capture_and_analyze,
mix_coach) still to build. Enables tuning-by-ear for everything else.

### 10. codebeat (07-20) — 🎯 FINISH · quick close
Public hook, shareable links, OG cards, trap-genre fix all landed. Likely just loose ends.
**Left:** verify + close.

### 11. ace-everywhere (06-12) — ✅ DONE
**ACE-Step is OFF RunPod — it now runs on Replicate (user confirmed 2026-08-03).** The
**Replicate provider** (`replicateService.ts`) + **Cog package** (`cog/cog.yaml`,
`cog/predict.py`, committed `97c32d6e`) shipped, and `aceStepService.isWorkerReady` now
prefers Replicate (needs `REPLICATE_API_TOKEN` + `REPLICATE_MODEL_VERSION`), with RunPod
Serverless and the local FastAPI worker as fallbacks. "Zero idle cost" — pay per generation
vs the retired RunPod pod's $0.34/hr always-on. The old RunPod pod is retired.

### 12. musicmind-harmonic (06-24) — 🎯 FINISH
WebLLM/musicMind harmonic intelligence; real work done. **Left:** trace what shipped, finish
the remaining phase. (Deep-trace at finish time.)

### ✅ google-login (07-03) — DONE
Shipped on prod. No action.
