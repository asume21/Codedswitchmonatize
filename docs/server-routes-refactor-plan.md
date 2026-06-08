# Server Routes Refactor Plan

## Goal

Break down `server/routes.ts` into smaller feature-specific route modules while preserving current API behavior.

## Proposed Schedule

1. Discovery pass, 1 hour
   - Inventory inline endpoints still living in `server/routes.ts`.
   - Group them by domain: AI generation, transcription, tracks, packs, providers, jam sessions, and legacy compatibility.
   - Identify duplicate mounts that already have route factories.

2. First extraction pass, 2 hours
   - Move low-risk inline groups into `server/routes/*` files.
   - Keep `registerRoutes()` as the composition root only.
   - Add focused route smoke tests where behavior is easy to assert without external providers.

3. Audio and AI extraction pass, 2-3 hours
   - Extract endpoints that touch upload handling, ffmpeg, AI providers, transcription, and credit deductions.
   - Preserve middleware order, especially auth, raw Stripe body parsing, upload limits, and credit deduction timing.

4. Cleanup and verification, 1 hour
   - Run `npm run check`.
   - Run targeted server unit tests and any affected route smoke tests.
   - Confirm no public API paths changed.

## Guardrails

- Do not change endpoint paths during extraction.
- Keep feature middleware next to the route factory that owns it.
- Prefer injecting `storage` into route factories instead of importing the storage singleton.
- Leave Stripe webhook routing and raw body parsing in the boot path unless the parser ordering is explicitly retested.
