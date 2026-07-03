# Google Login — Design

**Date:** 2026-07-03
**Status:** Approved (chat), implementing
**Scope:** "Continue with Google" on the login AND signup pages. Nothing else about auth changes.

## Approach (chosen from 3)

**Google Identity Services (GIS) button + server-side ID-token verification.**
No redirect flow, no passport, no third-party auth service. The existing
email/password auth, session cookie, JWT token, and credit granting stay
exactly as they are; Google is an alternative *entry point* into the same
session machinery.

Rejected: full OAuth redirect flow (only needed for Google API access on the
user's behalf — we only want identity) and Clerk/Supabase/Firebase (replaces a
working auth system for one button).

## Flow

1. Client renders Google's official button (GIS script, lazy-loaded).
2. User picks a Google account → browser receives an **ID token** (signed JWT).
3. Client POSTs `{ credential }` to `POST /api/auth/google`.
4. Server verifies the token with `google-auth-library` against
   `GOOGLE_CLIENT_ID`, requires `email_verified`.
5. Find-or-create by email:
   - **Existing user** → log them in (safe auto-link: Google verified email ownership).
   - **New user** → create with username from Google profile name and a
     **random unusable bcrypt password** (no schema change; `password` stays
     NOT NULL). Trial credits granted, same as `/register`.
6. Same session regenerate/save + response shape as `/login`:
   `{ message, user, userId, token }`.

## Components

- `server/lib/googleAuth.ts` — pure find-or-create logic (`verifier` injected
  for testability) + the real GIS verifier.
- `POST /api/auth/google` in `server/routes/auth.ts` — already behind
  `authLimiter` and on the `requireAuthExcept` public allowlist (`/api/auth`).
- `client/src/components/auth/GoogleSignInButton.tsx` — loads the GIS script,
  renders the branded button (dark theme), POSTs the credential, hands the
  response to an `onSuccess` callback. **Renders nothing when
  `VITE_GOOGLE_CLIENT_ID` is unset** — dev environments and production without
  configuration keep working untouched (dark deploy is safe).
- `client/src/pages/login.tsx` + `signup.tsx` — button under an "or" divider;
  on success runs the same post-login steps as the password flow (store token,
  seed subscription cache, redirect to `/dashboard`).

## Config

- `GOOGLE_CLIENT_ID` (server) and `VITE_GOOGLE_CLIENT_ID` (client) — the same
  OAuth Client ID value; both in `.env.example`.
- One-time user setup in Google Cloud Console (free): OAuth client ID, type
  "Web application", authorized JavaScript origins `http://localhost:5001` and
  `https://www.codedswitch.com`. **No redirect URIs needed** (GIS popup mode).

## Error handling

- No `GOOGLE_CLIENT_ID` on server → 501 "Google login not configured".
- Invalid/expired token → 401, friendly toast.
- Unverified Google email → 403.
- GIS script fails to load → button area stays empty; password login unaffected.

## Testing

- Unit: find-or-create logic with a mocked verifier + in-memory storage stub
  (new user created w/ hashed random password; existing user logged in, not
  duplicated; unverified email rejected).
- Real Google popup is not E2E-automatable; final verification is a manual
  click-through once the Client ID exists.
