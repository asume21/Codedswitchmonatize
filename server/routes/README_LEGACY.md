This `server/routes/` directory contains legacy route definitions (`index.ts`, `aiLyrics.ts`, `aiAudio.ts`, `aiSong.ts`, `aiMusic.ts`, `music.ts`) that are **not** mounted by the running server. The live API surface is defined in `server/routes.ts`, which is registered from `server/index.ts`.

If you add or change API endpoints, do it in `server/routes.ts` (and related services) to avoid diverging implementations. Keeping this file here prevents accidental edits to unused code paths.
