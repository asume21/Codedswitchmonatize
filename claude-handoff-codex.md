# CodedSwitch cleanup handoff

## Scope

This change intentionally touched only these files:

- `server/routes.ts`
- `server/routes/index.ts` (deleted)
- `client/src/lib/websenseBridge.ts`

`server/index.ts` and `server/index.prod.ts` were deliberately not edited.

## Changes made

### Removed two unreachable handlers from `server/routes.ts`

- Removed `GET /api/loops`.
  - It was registered after `app.use('/api/loops', createLoopRoutes())`.
  - `server/routes/loops.ts` already handles `router.get('/')`, sends the response, and does not call `next()`, so the later handler could never run.
  - Left `GET /api/loops/:filename(*)/audio` in place; it is a different, live route.

- Removed `GET /api/credits`.
  - It was registered after `app.use('/api/credits', createCreditRoutes(storage))`.
  - `server/routes/credits.ts` already handles `router.get('/')`, sends the response, and does not call `next()`, so the later handler could never run.

No active behavior was lost from either deletion: both handlers were unreachable in Express registration order.

### Deleted `server/routes/index.ts`

Both server entrypoints import `./routes`, which resolves to `server/routes.ts`; no source imports `routes/index`.

The deleted, inactive file contained these mounts, which have no active registration elsewhere after the deletion:

- `/api/billing`
- `/api/ai/lyrics`
- `/api/ai/song`
- `/api/ai/audio`
- `/api/ai/music`
- `/api/music`

They were already absent at runtime because the file was not imported. The deletion removes only the misleading duplicate source.

### Enforced the shared AudioContext invariant in `websenseBridge.ts`

WebSense capture previously constructed and closed a throwaway `AudioContext` only to read its state, sample rate, and base latency. It now imports and reads `getAudioContext()` instead.

This follows the singleton rule and avoids the known throwaway-context unlock bug documented in `AUDIT_2026-04-30.md:143`.

## Verification

Ran successfully:

```text
npx tsc --noEmit -p tsconfig.json
```

Exit code: `0` (no TypeScript errors).
