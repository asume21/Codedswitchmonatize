// Google Sign-In (GIS) — server-side ID-token verification + find-or-create.
// Spec: docs/superpowers/specs/2026-07-03-google-login-design.md
//
// The verifier is injected so the account logic is unit-testable without
// Google; the real verifier below is the only piece that talks to Google.

import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { IStorage } from "../storage";

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  /** Google display name — used to derive a username for new accounts. */
  name?: string;
}

export type GoogleTokenVerifier = (credential: string) => Promise<GoogleProfile>;

/** Real verifier: checks the ID token's signature and audience with Google. */
export function createGoogleVerifier(clientId: string): GoogleTokenVerifier {
  const client = new OAuth2Client(clientId);
  return async (credential: string) => {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("Google token has no email");
    return {
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name,
    };
  };
}

export class GoogleAuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Derive a username from the Google display name, falling back to the email
 *  local part — same fallback `/register` uses. */
export function usernameFromProfile(profile: GoogleProfile): string {
  const fromName = (profile.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return fromName.length >= 3 ? fromName : profile.email.split("@")[0];
}

/**
 * Log in (existing email — safe auto-link, Google verified ownership) or
 * create the account (random unusable password; schema unchanged).
 * Returns the user and whether it was just created (caller grants credits).
 */
export async function findOrCreateGoogleUser(storage: IStorage, profile: GoogleProfile) {
  if (!profile.emailVerified) {
    throw new GoogleAuthError("Google account email is not verified", 403);
  }

  const existing = await storage.getUserByEmail(profile.email);
  if (existing) return { user: existing, created: false };

  // Google users authenticate via Google — the password only exists because
  // the column is NOT NULL. Random 32 bytes, bcrypt-hashed: unguessable and
  // unusable until a future password-reset flow sets a real one.
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const base = usernameFromProfile(profile);

  // username is UNIQUE — two Google users can share a display name, so retry
  // the insert with a random suffix instead of surfacing a constraint error.
  let lastError: unknown;
  for (const username of [base, `${base}-${crypto.randomBytes(3).toString("hex")}`]) {
    try {
      const user = await storage.createUser({
        email: profile.email,
        password: unusablePassword,
        username,
      });
      return { user, created: true };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
