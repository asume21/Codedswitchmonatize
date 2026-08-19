import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { MemStorage, DatabaseStorage, type IStorage } from "./storage";
import { currentUser, requireAuthExcept } from "./middleware/auth";
import { globalLimiter } from "./middleware/rateLimiting";
import path from "path";
import fs from "fs";
import { ensureDataRoots } from "./services/localStorageService";

// Env validation lives in validateEnv() below — a single checklist rather than
// scattered ifs. Four separate top-of-file checks (SESSION_SECRET,
// AUTH_TOKEN_SECRET, APP_URL, OWNER_KEY) used to sit here and are now folded into
// it, so there is ONE place that answers "what does production require" instead
// of two that can drift apart.

const app = express();

// Lightweight healthcheck for Railway and other deploy platforms.
// Register this before sessions, auth, database-backed storage, and static
// serving so a boot-time dependency slowdown does not make the container look
// dead while it is still initializing.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Trust proxy for secure cookies behind Railway/load balancers
app.set('trust proxy', 1);

// Security headers
// ── Boot-time env validation ────────────────────────────────────────
// Ported from server/index.ts, which never runs in production (esbuild builds
// THIS file). Every one of these guards existed, was carefully written, and was
// filed in the one entrypoint that could not enforce it — so review saw
// "validated" while production booted unvalidated.
//
// Safe to add: all five were verified SET on the production service before this
// shipped, so it cannot fire on the current deployment. It is here to catch the
// day one goes missing, renamed, or lost in a service migration — a Stripe
// secret vanishing should stop the boot, not silently corrupt the credit ledger.
function validateEnv(): { sessionSecret: string } {
  const missing: string[] = [];
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
  if (!process.env.AUTH_TOKEN_SECRET) missing.push("AUTH_TOKEN_SECRET");
  if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!process.env.DATABASE_URL && !process.env.DATABASE_PUBLIC_URL) {
    missing.push("DATABASE_URL (or DATABASE_PUBLIC_URL)");
  }
  if (missing.length > 0) {
    console.error(`❌ FATAL: missing required env vars in production: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (process.env.OWNER_KEY && process.env.OWNER_KEY.length < 32) {
    console.warn("⚠️  OWNER_KEY < 32 chars — admin bypass disabled until rotated");
  }
  const aiKeys = [
    process.env.XAI_API_KEY, process.env.OPENAI_API_KEY,
    process.env.GEMINI_API_KEY, process.env.REPLICATE_API_TOKEN,
  ].filter(Boolean);
  if (aiKeys.length === 0) {
    console.warn("⚠️  no AI provider keys set (XAI/OPENAI/GEMINI/REPLICATE) — generation routes will 500");
  }
  if (!process.env.APP_URL) {
    console.warn("⚠️  APP_URL not set — CSP connectSrc and CORS may be too tight");
  }
  // Hand the validated secret back rather than letting callers re-read process.env.
  // The top-of-file `if (!SESSION_SECRET) process.exit(1)` this replaced was also
  // acting as a TYPE GUARD: deleting it turned SESSION_SECRET back into
  // `string | undefined` and broke the session config below (caught by tsc, not by
  // any test). Returning it keeps the guarantee in the type system instead of in a
  // side effect, so it cannot be lost again by moving code around.
  return { sessionSecret: process.env.SESSION_SECRET as string };
}
const { sessionSecret } = validateEnv();

// ── CORS ────────────────────────────────────────────────────────────
// Also index.ts-only until now, which meant CORS_ALLOWED_ORIGINS did NOTHING in
// production: it could be set in the dashboard and would never be read.
// Additive by construction — it only ATTACHES headers for an allowed origin and
// answers preflight. It never rejects a request, so it cannot break traffic that
// works today (CORS is enforced by browsers, not by this server).
const normalizeOrigin = (value: string) => {
  try { return new URL(value).origin; } catch { return value.replace(/\/$/, ""); }
};
const rawAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",").map(o => o.trim()).filter(Boolean) ?? [];
const allowedOrigins = (rawAllowedOrigins.length
  ? rawAllowedOrigins
  : [process.env.APP_URL || ""].filter(Boolean)
).map(normalizeOrigin);
const hasWildcardOrigin = allowedOrigins.includes("*");
const isAllowedOrigin = (originHeader?: string) => {
  if (!originHeader) return false;
  if (hasWildcardOrigin) return true;
  return allowedOrigins.includes(normalizeOrigin(originHeader));
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", process.env.APP_URL || ""].filter(Boolean),
      mediaSrc: ["'self'", "data:", "blob:", "https:"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: "deny" },
  xssFilter: true,
}));

// Set LOCAL_OBJECTS_DIR early so every route resolves uploads to ONE root.
// Mirrors server/index.ts:18-29 — prod was never setting it, so routes that read
// `process.env.LOCAL_OBJECTS_DIR || <cwd>/objects` (server/routes/songs.ts:108,417,488
// and friends) silently fell back to <cwd>/objects while inline handlers in
// server/routes.ts picked /data/objects on any host that has /data. Same upload,
// two storage roots, decided by which endpoint prefix you hit.
// On Railway /data does not exist and cwd is /app, so this resolves to the mounted
// volume at /app/objects — the current behaviour is preserved, not changed.
const LOCAL_OBJECTS_DIR = fs.existsSync('/data')
  ? '/data/objects'
  : path.join(process.cwd(), 'objects');
process.env.LOCAL_OBJECTS_DIR = LOCAL_OBJECTS_DIR;
console.log('📁 LOCAL_OBJECTS_DIR set to:', LOCAL_OBJECTS_DIR);
fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });
fs.mkdirSync(path.join(LOCAL_OBJECTS_DIR, 'converted'), { recursive: true });

const dataRoot = path.resolve("data");
ensureDataRoots(dataRoot);
app.use("/data", express.static(dataRoot));

// Serve audio assets (Cymatics drum/bass/keys one-shots, loops, etc.) the same
// way dev (index.ts) does. Without this, /assets/* fell through to the SPA
// catch-all and returned index.html — so Tone/decodeAudioData got HTML instead
// of a WAV and the Organism drums/texture (and the Beat Maker) went silent or
// synth-only in production. Static files, not user data — served before auth.
const assetsRoot = path.resolve(process.cwd(), "server", "Assets");
app.use("/assets", express.static(assetsRoot, {
  maxAge: "7d",
  setHeaders: (res) => {
    res.set("Accept-Ranges", "bytes");
  },
}));
console.log(`📂 Audio assets served from: ${assetsRoot}`);

// Serve separated / generated stems. Dev (index.ts:168) mounted this and
// production never did, so every /api/stems/* url this server hands out —
// stem separation, MusicGen stems, and anything downstream that plays them —
// 404'd in production while working perfectly on localhost. Same shape as the
// /assets gap fixed above.
//
// TWO roots, because the writers disagree about where a stem lives:
//   stemGeneration.ts:66  writes objects/musicgen-stems/x.wav → /api/stems/musicgen-stems/x.wav
//   stemSeparation.ts:103 writes objects/stems/x.mp3         → /api/stems/x.mp3
// The first resolves against the objects root, the second against objects/stems.
// Mounting the root first preserves dev's exact behaviour; the stems dir is a
// fallback for the urls that would otherwise miss by one path segment.
app.use("/api/stems", express.static(LOCAL_OBJECTS_DIR, {
  maxAge: "1d",
  setHeaders: (res) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Accept-Ranges", "bytes");
  },
}));
app.use("/api/stems", express.static(path.join(LOCAL_OBJECTS_DIR, "stems"), {
  maxAge: "1d",
  setHeaders: (res) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Accept-Ranges", "bytes");
  },
}));
console.log(`📂 Stems served from: ${LOCAL_OBJECTS_DIR} and ${path.join(LOCAL_OBJECTS_DIR, "stems")}`);

const referenceBeatsPath = [
  path.resolve(process.cwd(), "audio", "reference-beats"),
  path.resolve(process.cwd(), "..", "audio", "reference-beats"),
].find((candidate) => fs.existsSync(candidate));

if (referenceBeatsPath) {
  app.use("/api/reference-beats", express.static(referenceBeatsPath, {
    maxAge: "7d",
    setHeaders: (res) => {
      res.set("Cache-Control", "public, max-age=604800");
      res.set("Accept-Ranges", "bytes");
    },
  }));
  console.log(`📂 Reference beats served from: ${referenceBeatsPath}`);
} else {
  console.warn("⚠️ Reference beats path not found");
}

// Stripe webhook must receive the raw body for signature verification.
// Mount this BEFORE json/urlencoded parsers.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Sessions with PostgreSQL - properly configured
const PgSession = connectPgSimple(session);

let sessionStore;
const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
const hasDatabase = Boolean(databaseUrl && databaseUrl.length > 0);

if (hasDatabase) {
  console.log('🔄 Initializing PostgreSQL session store...');
  try {
    // Force rebuild - PostgreSQL sessions v2 + PUBLIC URL fix
    sessionStore = new PgSession({
      conString: databaseUrl,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60,
      errorLog: (...args) => console.error('Session store error:', ...args)
    });
    console.log('✅ PostgreSQL session store initialized');
  } catch (error) {
    console.error('❌ Failed to create PostgreSQL session store:', error);
    console.log('⚠️ Falling back to MemoryStore');
    sessionStore = undefined;
  }
} else {
  console.log('⚠️ DATABASE_URL not set - using MemoryStore (not recommended for production)');
}

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret,   // validated at boot — see validateEnv()
    resave: false,
    saveUninitialized: false,
    proxy: true,
    name: 'codedswitch.sid',
    cookie: {
      sameSite: "none" as const,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: true,
    },
  }),
);

console.log(sessionStore ? '✅ Session middleware: PostgreSQL' : '⚠️ Session middleware: MemoryStore (temporary)');

// Standard body parsers with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Global rate limiting for all API endpoints
app.use('/api/', globalLimiter);

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(`${new Date().toLocaleTimeString()} [express] ${logLine}`);
    }
  });

  next();
});

(async () => {
  // Refuse to boot in production without a database.
  //
  // This guard existed ONLY in server/index.ts — which never runs in production
  // (esbuild.config.js builds THIS file; package.json start and the Dockerfile CMD
  // both run its bundle). So the protection was real, carefully commented, and
  // filed in the one entrypoint that could never enforce it.
  //
  // Without it a missing DATABASE_URL logs a warning and boots on MemStorage: the
  // app comes up looking healthy and serves traffic while every user, session and
  // credit balance lives in RAM and is wiped on the next restart. No crash, no
  // alert, silent data loss — the worst possible failure mode for the one thing
  // that must not fail quietly.
  //
  // Safe to add: DATABASE_URL is confirmed set on the production service, so this
  // cannot fire on the current deployment. It exists to catch the day it is
  // removed, renamed, or lost in a service migration.
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !databaseUrl) {
    console.error('❌ FATAL: refusing to boot in production without DATABASE_URL — ' +
      'MemStorage would wipe every user, session and credit balance on restart.');
    process.exit(1);
  }

  // Choose storage implementation
  const storage: IStorage = databaseUrl
    ? new DatabaseStorage()
    : new MemStorage();

  // Attach current user middleware
  app.use(currentUser(storage));

  // Blanket auth: protect all /api/* routes except public endpoints
  app.use(requireAuthExcept([
    "/api/auth",
    "/api/health",
    "/api/subscription-status",
    "/api/check-license",
    "/api/webhooks/stripe",
    "/api/reference-beats",
    "/api/blog",
    "/api/social/feed/public",
    "/api/songs/public",
    "/api/loops",             // melodic loop catalog + audio (not user data; like /api/samples)
    "/api/samples",           // drum/instrument sample library WAVs (static, not user data). Tone.Sampler/raw-fetch media requests can't attach a bearer token, so this MUST be public or DrumGenerator collapses to silence (no synth fallback). The /api/samples/generate-pack POST keeps its own route-level requireAuth().
    "/api/neumann-bass",      // 159 shared chromatic bass multisamples (static instrument, not user data; like /api/loops). Tone.Player media fetches can't attach a bearer token, so this MUST be public or the bass collapses to the synth fallback.
    "/api/sample-profiles",   // DSP fingerprints for drum/bass WAVs — public read-only, no user data
    "/api/organism/kits",     // shared drum kits + 808 bass samples (static instruments, not user data). Raw fetch / Tone.Sampler media fetches can't attach a bearer token, so this MUST be public or the kit collapses to the synth fallback.
    "/api/ai-music/compose",  // deterministic song-arc plan — no user data; guests need this for the demo build
    "/api/code-to-music",     // Codebeat public hook — deterministic, no AI, no user data; guests try it before signup
    "/api/demo",              // public AI Perception demo endpoint (audio analyze, no credits).
                              // Was dev-only by accident: the guest demo worked on localhost and
                              // 401'd in production. This list and the one in server/index.ts must
                              // agree except where a difference is deliberate and commented
                              // (/api/audio-debug is dev-only by design — the route itself is
                              // NODE_ENV-gated at mount time). NOTE: /api/reference-beats and
                              // /api/sample-profiles appear only in THIS list, but that is
                              // redundancy, not a real gap — both entrypoints mount
                              // express.static for them (index.ts:150, index.prod.ts:108) BEFORE
                              // requireAuthExcept runs, so the static handler answers either way.
    "/api/ai/next-section",   // conductor consult (Ollama → aceEngine) — no user data; the /organism guest demo's AIDirector calls it every section
    "/api/webear/",           // MCP SSE relay — self-authenticates via wbr_ bearer keys
    "/api/webeye/",           // WebEye browser capture relay
    "/api/websense/",         // WebSense performance telemetry relay
    "/api/webnerve/",         // WebNerve query & resource timing relay
    "/api/webshield/",        // WebShield security scan relay
    "/api/weblog/",           // WebLog console & state snapshot relay
    "/api/mcp",               // legacy REST gateway (validate-key/analyze/describe) — self-authed
  ]));

  const server = await registerRoutes(app, storage);

  // ── SEO: canonical domain redirect ──
  // Redirect non-www → www and http → https in production
  app.use((req, res, next) => {
    const host = req.hostname;
    if (host === "codedswitch.com") {
      return res.redirect(301, `https://www.codedswitch.com${req.originalUrl}`);
    }
    next();
  });

  // ── SEO: server-side 301 redirects for legacy routes ──
  const legacyRedirects: Record<string, string> = {
    "/music-studio": "/",
    "/song-uploader": "/",
    "/beat-studio": "/",
    "/melody-composer": "/",
    "/unified-studio": "/",
    "/flow": "/",
    "/code-translator": "/",
    "/codebeat-studio": "/",
    "/pro-console": "/",
    "/midi-controller": "/",
    "/advanced-sequencer": "/",
    "/wavetable-oscillator": "/",
    "/pack-generator": "/",
    "/codebeat-studio-direct": "/",
    "/piano-roll": "/",
    "/granular-engine": "/",
    "/mid-controller": "/",
  };

  app.use((req, res, next) => {
    const target = legacyRedirects[req.path];
    if (target) {
      return res.redirect(301, target);
    }
    next();
  });

  // Production static file serving - look in dist/client
  const distPath = path.resolve(process.cwd(), "dist", "client");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // ── Route-specific social preview cards ──
  // Link crawlers (Discord, Twitter/X, iMessage, Slack) don't run JS, so the
  // SPA's single index.html gives every deep link the same generic card. For
  // shareable pages we swap in on-topic Open Graph tags at serve time. Codebeat
  // is our top-of-funnel share target, so a pasted /codebeat link must sell the
  // feature — not describe the whole studio.
  // Beyond social cards, these tags are the ONLY per-page signal Google reads
  // before it runs any JavaScript. Without them every route served the identical
  // homepage <title> + description, and near-duplicate pages get filed under
  // "Crawled - currently not indexed" (GSC 2026-07-23: 8 pages in that bucket).
  // Every public route in the /sitemap.xml list needs an entry here.
  // `image` is optional — omit it to keep the default homepage card.
  const DEFAULT_OG_IMAGE = "/og-image.jpg";
  const OG_OVERRIDES: Record<string, { title: string; description: string; image?: string }> = {
    "/codebeat": {
      title: "Codebeat — Turn your code into a beat | CodedSwitch",
      description:
        "Paste any function and watch its real structure — loops, branches, names — become a song with a key, tempo, and a drop. Try it free, no signup.",
      image: "/codebeat-og.png",
    },
    "/organism": {
      title: "The Organism — AI band that jams with you live | CodedSwitch",
      description:
        "A live AI band that listens and plays along in real time: drums, bass, keys and melody locking to your groove. Free 60-second demo, no signup needed.",
    },
    "/pricing": {
      title: "Pricing — Plans & credits | CodedSwitch",
      description:
        "Simple plans for AI music production. Start free, then pay only for the credits you use across beat generation, stem separation, and full song rendering.",
    },
    "/developers": {
      title: "Developers — Music generation API | CodedSwitch",
      description:
        "Build with the CodedSwitch API. Generate beats, melodies, and full arrangements programmatically, with credit-based pricing and straightforward REST endpoints.",
    },
    "/blog": {
      title: "Blog — AI music production guides | CodedSwitch",
      description:
        "Tutorials and deep dives on AI music production: building beats, arranging songs, mixing, and getting the most out of the CodedSwitch studio.",
    },
    "/sitemap": {
      title: "Sitemap — All pages | CodedSwitch",
      description: "Browse every public page on CodedSwitch, from the studio and live AI band to pricing, developer docs, and guides.",
    },
    "/login": {
      title: "Log in | CodedSwitch",
      description: "Log in to your CodedSwitch account to open your studio, projects, and saved beats.",
    },
    "/signup": {
      title: "Sign up free | CodedSwitch",
      description:
        "Create a free CodedSwitch account and start making AI-powered beats, melodies, and full songs in your browser. No card required.",
    },
  };

  let cachedIndexHtml: string | null = null;
  const readIndexHtml = (): string => {
    if (cachedIndexHtml == null) {
      cachedIndexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf8");
    }
    return cachedIndexHtml;
  };

  const applyOgOverride = (
    html: string,
    url: string,
    img: string,
    o: { title: string; description: string },
  ): string => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const t = esc(o.title);
    const d = esc(o.description);
    const u = esc(url);
    const i = esc(img);
    return html
      .replace(/(<title>)[\s\S]*?(<\/title>)/, `$1${t}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${u}$2`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${u}$2`)
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${i}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`)
      .replace(/(<meta name="twitter:url" content=")[^"]*(")/, `$1${u}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${i}$2`);
  };

  app.get("/codebeat", (req, res) => {
    const canonicalBase = process.env.APP_URL || "https://www.codedswitch.com";
    // Keep the shared ?s= seed on the canonical URL so the card + destination match.
    const query = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    const override = OG_OVERRIDES["/codebeat"];
    // og:image must be an absolute URL for crawlers — relative paths don't render.
    const html = applyOgOverride(
      readIndexHtml(),
      `${canonicalBase}/codebeat${query}`,
      `${canonicalBase}${override.image}`,
      override,
    );
    res.set("Content-Type", "text/html; charset=utf-8").send(html);
  });

  // Per-route metadata for the remaining public pages. Registered BEFORE
  // express.static so these win over the generic dist/index.html — the static
  // handler would otherwise answer first and serve the homepage's tags.
  // /codebeat keeps its own handler above because it carries a ?s= share seed.
  for (const routePath of Object.keys(OG_OVERRIDES)) {
    if (routePath === "/codebeat") continue;
    app.get(routePath, (_req, res) => {
      const canonicalBase = process.env.APP_URL || "https://www.codedswitch.com";
      const override = OG_OVERRIDES[routePath];
      const html = applyOgOverride(
        readIndexHtml(),
        `${canonicalBase}${routePath}`,
        `${canonicalBase}${override.image ?? DEFAULT_OG_IMAGE}`,
        override,
      );
      res.set("Content-Type", "text/html; charset=utf-8").send(html);
    });
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // Error handler must be last — after all routes and static serving.
  // ALWAYS returns JSON for API routes to prevent "HTML instead of JSON" errors.
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({
        success: false,
        error: status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
        message,
      });
    }
    console.error(`[error] ${req.method} ${req.path} ${status} ${message}`, err.stack);
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 4000 if not specified to align with local API clients.
  const port = parseInt(process.env.PORT || '4000', 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${port}`);
  });
})();
