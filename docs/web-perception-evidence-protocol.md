# Web Perception: evidence-first evaluation on CodeSwitch

## Claim under test
Does access to WebEar or the six-sensor Web Perception system make an AI coding agent diagnose and fix real user-visible defects more accurately, with less effort, than ordinary code/log/Playwright inspection?

This experiment is **not complete** merely because an audio analyzer produces numbers. Capture metrics, agent outcomes, and user impact must be distinguished.

## Run environment
Use a disposable local checkout, isolated test DB/configuration, and test accounts. Never run destructive modifications or generate paid API traffic on production. Pin the same CodeSwitch commit, dependencies, browser, test data, and random seed for both agent arms. Store real tokens only in environment variables, never in benchmark captures.

## Evidence acquisition (existing scripts)
1. Install dependencies, ffmpeg, and Playwright on a trusted machine.
2. Start the CodeSwitch development app, as configured by its current README.
3. Record the baseline before changing code:

   `node scripts/capture-fire-beats.mjs baseline 42`

4. Introduce one known, reversible fault **in a separate local branch**. Record the exact diff as hidden ground truth. Examples: inappropriate master gain that causes clipping; deliberate delay in a relevant audio scheduling call; an API timing regression. Only choose a fault that you can actually reproduce.
5. Capture the faulty state with matching environment, preset, seed and recording length:

   `node scripts/capture-fire-beats.mjs candidate 42`

6. Generate a machine-readable measurement diff:

   `node scripts/compare-perception-evidence.mjs marketing/output/fire-beats/baseline/manifest.json marketing/output/fire-beats/candidate/manifest.json > evidence.json`

The exact output path is controlled by the capture script's LABEL argument; verify artifacts and manifests exist. `evidence.json` must say `comparable: true` before interpreting results. Do not claim these captures measure agent performance.

## Independent AI-agent runs (the primary test)
Run **at least three different faults**. For each fault, reset the application to the same defective commit and give a clean coding agent the same prompt, time budget and permissions, randomized in order:

- **A — Baseline:** normal source inspection, ordinary logs, regular Playwright tests/traces; no WebEar or Web Perception calls or outputs.
- **B — WebEar:** all baseline tools plus WebEar audio capture/analysis and evidence.
- **C — Web Perception:** all baseline tools plus unified audio, visuals, runtime telemetry, network and console evidence when the live relay supports them.

Do not pass analysis from B or C into A. Fresh sessions and independent worktrees prevent leakage. Capture actual tool calls and wall-clock timing; don't use synthetic answers as evidence.

## Ground-truth grading (blind to arm)
For each trial independently record:
- Actual root cause (from hidden fault diff).
- Whether agent named correct root cause before the fix (yes/no).
- Whether its patch removes the defect and leaves existing tests passing (yes/no).
- Time to first correct diagnosis and time to verified fix.
- Tool calls, token consumption if available, and external API cost.
- Whether metrics/screenshot/audio provided evidence that baseline could not access.

Use the same post-fix replay, same seed, and independent behavioral acceptance checks for all arms. For audio, don't infer subjective sound quality solely from waveform scores; include blinded listening where possible.

## Fairness and operational limitations
- CodeSwitch already has dedicated WebEar capture machinery. Verify tools are live before trial; a README or code path is not proof of successful end-to-end execution.
- Web Perception's browser SDK exists, but the full six-sensor remote MCP system has not yet been end-to-end validated in this environment. If arm C cannot connect, report **not tested**, not a failure of agent quality.
- A deliberately injected defect measures diagnosis on controlled cases; replicate with an organic production bug only after the harness works.
- Run at least three fault classes and preferably repeat each arm with different independent trials before drawing a product conclusion.
- Declare the final verdict only after recording evidence: improvement, parity, regression, or inconclusive.

## Current status (2026-10-28)
GitHub source inspection confirms the baseline scripts exist; the accompanying diff tool is committed on an experiment branch. Actual app launches, WebEar calls, baseline/candidate captures, and A/B/C agent runs **have not been performed** in this ChatGPT session because this runtime cannot resolve github.com from the execution container, and the live CodeSwitch/WebEar runtime is not exposed as an executable connector. No outcome measurements are claimed.
