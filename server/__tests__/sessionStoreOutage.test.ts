import { describe, it, expect } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import signature from "cookie-signature";
import type { AddressInfo } from "node:net";

/**
 * Regression: a session-store outage used to 500 every API request.
 *
 * express-session forwards a store read failure to the error handler, so the
 * throw happened UPSTREAM of the route — /api/check-license never reached its
 * own fail-open path and the client logged "License validation failed:
 * ApiError: Internal Server Error". server/index.ts now mounts the session
 * middleware behind a wrapper that swallows the store error and continues
 * without a session.
 *
 * Note the store is only read when the request carries a VALIDLY SIGNED
 * cookie; an unsigned one is discarded and a fresh session is made, which is
 * why this test signs its cookie with the same secret.
 */

const SECRET = "test-secret";

function brokenStore() {
  const store = new session.MemoryStore();
  // Empty message, matching the real failure that surfaced as the literal
  // string "Internal Server Error" from the global handler's fallback.
  store.get = (_sid, cb) => cb(new Error());
  return store;
}

function makeApp(withWrapper: boolean) {
  const app = express();
  const mw = session({
    store: brokenStore(),
    secret: SECRET,
    resave: false,
    saveUninitialized: false,
    name: "codedswitch.sid",
  });

  if (withWrapper) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      mw(req, res, () => next());
    });
  } else {
    app.use(mw);
  }

  // Stand-in for checkLicenseHandler's unauthenticated fail-open branch.
  app.get("/api/check-license", (req: Request, res: Response) => {
    res.json({ isPro: false, sawSession: Boolean(req.session) });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  });

  return app;
}

async function get(app: express.Express) {
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const { port } = server.address() as AddressInfo;
    const cookie = encodeURIComponent("s:" + signature.sign("abc", SECRET));
    const res = await fetch(`http://127.0.0.1:${port}/api/check-license`, {
      headers: { Cookie: `codedswitch.sid=${cookie}` },
    });
    return { status: res.status, body: await res.json() as any };
  } finally {
    server.close();
  }
}

describe("session store outage", () => {
  it("500s the request when the middleware is mounted unwrapped (the old bug)", async () => {
    const { status, body } = await get(makeApp(false));
    expect(status).toBe(500);
    expect(body.message).toBe("Internal Server Error");
  });

  it("degrades to an unauthenticated request when wrapped", async () => {
    const { status, body } = await get(makeApp(true));
    expect(status).toBe(200);
    // Fails open on availability, closed on privilege: no session, so no userId.
    expect(body.sawSession).toBe(false);
    expect(body.isPro).toBe(false);
  });
});
