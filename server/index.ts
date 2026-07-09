import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { MemStorage, DatabaseStorage, type IStorage } from "./storage";
import { currentUser, requireAuthExcept } from "./middleware/auth";
import { runMigrations } from "./migrations/runMigrations";
import { ensureDataRoots } from "./services/localStorageService";
import { globalLimiter } from "./middleware/rateLimiting";
import { logger } from "./lib/logger";

// Set LOCAL_OBJECTS_DIR early so all routes use consistent paths
// Use /data if available (Railway persistent volume), otherwise use local objects
const LOCAL_OBJECTS_DIR = fs.existsSync('/data') 
  ? path.resolve('/data', 'objects')
  : path.resolve(process.cwd(), 'objects');
process.env.LOCAL_OBJECTS_DIR = LOCAL_OBJECTS_DIR;
console.log('📁 LOCAL_OBJECTS_DIR set to:', LOCAL_OBJECTS_DIR);

// Ensure the directory exists
try {
  fs.mkdirSync(LOCAL_OBJECTS_DIR, { recursive: true });
  fs.mkdirSync(path.join(LOCAL_OBJECTS_DIR, 'converted'), { recursive: true });
} catch (err) {
  console.warn('⚠️ Could not create storage directories:', err);
}

// Process-level safety net. The server holds long-lived browser connections
// (WebEar relay SSE, audio-debug captures); when a tab navigates away, the
// socket can die mid-read and surface as an ECONNRESET inside a promise no
// try/catch owns. Node's default is to kill the process — one closed tab
// took down the whole API (2026-07-09). Log and keep serving instead.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection (server kept alive)');
});
process.on('uncaughtException', (err) => {
  const code = (err as NodeJS.ErrnoException).code;
  // Socket-noise errors from disconnecting clients are survivable. Anything
  // else is a real bug: log loudly and exit so the platform restarts us
  // cleanly rather than running in an unknown state.
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNABORTED') {
    logger.error({ code, err }, 'Client socket error (server kept alive)');
    return;
  }
  logger.error({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

const app = express();

// Lightweight healthcheck for deploy platforms
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Detect environment
const isProduction = process.env.NODE_ENV === "production";

// Boot-time env validation. Fail fast in production rather than discovering a
// missing key the first time a customer hits the failing route.
//
// Hard requirements (process.exit on miss):
//   SESSION_SECRET          — session cookie signing
//   AUTH_TOKEN_SECRET       — JWT signing
//   STRIPE_SECRET_KEY       — every revenue path
//   STRIPE_WEBHOOK_SECRET   — webhook signature verification (silent
//                             corruption of credit ledger if missing)
//   DATABASE_URL or DATABASE_PUBLIC_URL — without a DB the server falls
//                             back to MemStorage, which wipes auth/credits/
//                             sessions on every restart. Catastrophic in
//                             production; not just slow — actively wrong.
//
// Soft warnings (log + continue): things the studio needs but won't corrupt
// data if missing.
function validateEnv() {
  const missing: string[] = [];

  if (isProduction) {
    if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
    if (!process.env.AUTH_TOKEN_SECRET) missing.push("AUTH_TOKEN_SECRET");
    if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!process.env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
    if (!process.env.DATABASE_URL && !process.env.DATABASE_PUBLIC_URL) {
      missing.push("DATABASE_URL (or DATABASE_PUBLIC_URL)");
    }
  }

  if (missing.length > 0) {
    logger.fatal(
      { missing },
      "FATAL: required env vars missing for production boot — refusing to start",
    );
    // Mirror to stderr in plain text so platform logs catch it even if the
    // JSON drain isn't wired up yet.
    console.error(
      `❌ FATAL: missing required env vars in production: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  if (process.env.OWNER_KEY && process.env.OWNER_KEY.length < 32) {
    logger.warn(
      { ownerKeyLength: process.env.OWNER_KEY.length },
      "OWNER_KEY < 32 chars — admin bypass disabled until rotated",
    );
  }

  if (isProduction) {
    const aiKeys = [
      process.env.XAI_API_KEY,
      process.env.OPENAI_API_KEY,
      process.env.GEMINI_API_KEY,
      process.env.REPLICATE_API_TOKEN,
    ].filter(Boolean);
    if (aiKeys.length === 0) {
      logger.warn(
        {},
        "no AI provider keys set (XAI/OPENAI/GEMINI/REPLICATE) — generation routes will 500",
      );
    }
    if (!process.env.APP_URL) {
      logger.warn({}, "APP_URL not set — CSP connectSrc and CORS may be too tight");
    }
  }
}

validateEnv();

const dataRoot = path.resolve("data");
ensureDataRoots(dataRoot);
app.use("/data", express.static(dataRoot));

// Serve audio assets (loops, bass samples, etc.)
// Resolve from repo root so packaged assets are available in prod.
const assetsRoot = path.resolve(process.cwd(), "server", "Assets");
app.use("/assets", express.static(assetsRoot));

// Serve reference beats
const referenceBeatsPath = [
  path.resolve(process.cwd(), "audio", "reference-beats"),
  path.resolve(process.cwd(), "..", "audio", "reference-beats"),
].find((candidate) => fs.existsSync(candidate));
if (referenceBeatsPath) {
  app.use("/api/reference-beats", express.static(referenceBeatsPath, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      res.set('Cache-Control', 'public, max-age=604800');
      res.set('Accept-Ranges', 'bytes');
    }
  }));
  console.log(`📂 Reference beats served from: ${referenceBeatsPath}`);
} else {
  console.warn("⚠️  Reference beats path not found");
}

// Serve stem separation output files (include musicgen-stems subfolder)
const stemsRoot = LOCAL_OBJECTS_DIR;
app.use("/api/stems", express.static(stemsRoot, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wav') || filePath.endsWith('.mp3')) {
      res.set('Cache-Control', 'public, max-age=86400');
    }
    res.set('Accept-Ranges', 'bytes');
  }
}));

// Serve sample library files — check env var first, then bundled audio/samples/
const sampleLibraryPath = [
  process.env.SAMPLE_LIBRARY_PATH,
  path.resolve(process.cwd(), "audio", "samples"),
  path.resolve(process.cwd(), "..", "audio", "samples"),
  isProduction ? null : path.resolve("D:\\DATA SET\\good-sounds\\sound_files"),
].filter(Boolean).find((p) => p && fs.existsSync(p)) ?? null;
if (sampleLibraryPath) {
  app.use("/api/samples", express.static(sampleLibraryPath, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      res.set('Cache-Control', 'public, max-age=604800');
      res.set('Accept-Ranges', 'bytes');
    }
  }));
  console.log(`📂 Sample library served from: ${sampleLibraryPath}`);
} else {
  console.warn('⚠️  Sample library path not found — drum samples will use synth fallback');
}

// Trust proxy for secure cookies (Railway, Replit, etc.)
app.set('trust proxy', 1);

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
};

const rawAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()).filter(Boolean) ?? [];
const defaultDevOrigins = ["http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:5173", "http://127.0.0.1:5000"];
const allowedOrigins = (rawAllowedOrigins.length
  ? rawAllowedOrigins
  : (isProduction ? [process.env.APP_URL || ""].filter(Boolean) : defaultDevOrigins)
).map(normalizeOrigin);

const hasWildcardOrigin = allowedOrigins.includes("*");

const isAllowedOrigin = (originHeader?: string) => {
  if (!originHeader) return false;
  if (hasWildcardOrigin) return true;
  const normalized = normalizeOrigin(originHeader);
  return allowedOrigins.includes(normalized);
};

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
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
  } : false,
  crossOriginEmbedderPolicy: false, // Needed for audio/media playback
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  frameguard: { action: "deny" },
  xssFilter: true,
}));

// Enable CORS (dev allows localhost, prod uses configured list)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Stripe webhook must receive the raw body for signature verification.
// Mount this BEFORE json/urlencoded parsers.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Sessions with PostgreSQL - properly configured
const PgSession = connectPgSimple(session);

let sessionStore;
// Prefer internal DATABASE_URL (free on Railway) over public URL (costs money)
const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
const hasDatabase = databaseUrl && databaseUrl.length > 0;

if (hasDatabase) {
  try {
    sessionStore = new PgSession({
      conString: databaseUrl,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60,
      errorLog: (...args) => console.error('Session store error:', ...args)
    });
  } catch (error) {
    console.error('Failed to create PostgreSQL session store:', error);
    sessionStore = undefined;
  }
}

// Environment-aware cookie configuration
const cookieConfig = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  path: '/',
  // Only use secure cookies in production (HTTPS required)
  secure: isProduction,
  // Use 'none' in production for cross-site, 'lax' in development
  sameSite: isProduction ? "none" as const : "lax" as const,
  // Set domain for production cookies to allow cross-origin requests
  ...(isProduction && process.env.APP_URL && (() => {
    try {
      const url = new URL(process.env.APP_URL!);
      return { domain: url.hostname };
    } catch {
      return {};
    }
  })()),
};

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "dev_session_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: cookieConfig,
    proxy: isProduction,
    name: 'codedswitch.sid',
  }),
);

// Standard body parsers with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Global rate limiting for all API endpoints
app.use('/api/', globalLimiter);

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

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run database migrations first
  await runMigrations();
  
  // Choose storage implementation - prefer internal URL (free on Railway).
  // Defense-in-depth: validateEnv() already exits in production if no DB URL
  // is set, but guard here too so any future refactor that loosens boot-time
  // validation cannot silently fall back to MemStorage in prod (which wipes
  // auth/credits on every restart).
  const hasDatabaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (isProduction && !hasDatabaseUrl) {
    logger.fatal({}, "FATAL: refusing to boot in production with MemStorage — set DATABASE_URL");
    console.error("❌ FATAL: production storage selection reached without DATABASE_URL");
    process.exit(1);
  }
  const storage: IStorage = hasDatabaseUrl
    ? new DatabaseStorage()
    : new MemStorage();

  // Attach current user middleware (dev falls back to default user)
  app.use(currentUser(storage));

  // Blanket auth: protect all /api/* routes except public endpoints
  app.use(requireAuthExcept([
    "/api/auth",              // login, register, logout
    "/api/health",            // health check
    "/api/subscription-status", // auth context check (returns isAuthenticated: false for guests)
    "/api/check-license",     // license validation
    "/api/webhooks/stripe",   // Stripe webhook
    "/api/blog",              // public blog content
    "/api/social/feed/public", // public social feed
    "/api/songs/public",      // public shared songs
    "/api/loops",             // melodic loop catalog + audio (not user data; like /api/samples)
    "/api/samples",           // drum/instrument sample library WAVs (static, not user data). In dev an earlier express.static mount also serves these, but whitelist the prefix too so the route path doesn't depend on middleware ordering (prod has no static mount). generate-pack keeps its own route-level requireAuth().
    "/api/neumann-bass",      // 159 shared chromatic bass multisamples (static instrument, not user data; like /api/loops). Tone.Player media fetches can't attach a bearer token, so this MUST be public or the bass collapses to the synth fallback.
    "/api/organism/kits",     // shared drum kits + 808 bass samples (static instruments, not user data; like /api/neumann-bass). Raw fetch / Tone.Sampler media fetches can't attach a bearer token, so this MUST be public or the kit collapses to the synth fallback.
    "/api/webear/",           // MCP SSE relay — self-authenticates via wbr_ bearer keys (trailing slash keeps /api/webear-keys session-gated)
    "/api/webeye/",           // WebEye browser capture relay
    "/api/websense/",         // WebSense performance telemetry relay
    "/api/webnerve/",         // WebNerve query & resource timing relay
    "/api/webshield/",        // WebShield security scan relay
    "/api/weblog/",           // WebLog console & state snapshot relay
    "/api/mcp",               // legacy REST gateway (validate-key/analyze/describe) — self-authed
    "/api/ai-music/compose",  // deterministic song-arc plan — no user data; guests need this for the demo build
    "/api/demo",              // public AI Perception demo endpoint (audio analyze, no credits)
    // Dev-only: audio-debug bridge is gated by NODE_ENV !== 'production' at
    // route mount time (server/routes.ts), so the prefix can never reach
    // production. Whitelisted here so the local MCP capture flow works
    // without an auth token.
    ...(process.env.NODE_ENV !== 'production' ? ["/api/audio-debug"] : []),
  ]));

  const server = await registerRoutes(app, storage);

  // Global error handler — ALWAYS returns JSON for /api/* routes.
  // This catches unhandled errors, including any middleware that might
  // otherwise send HTML error pages (e.g. body-parser, multer).
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (res.headersSent) {
      logger.error(
        { method: req.method, path: req.path, status, err },
        "headers already sent — error swallowed",
      );
      return;
    }

    if (status >= 500) {
      logger.error(
        { method: req.method, path: req.path, status, err },
        "unhandled api error",
      );
    }

    // Force JSON for API routes to prevent "HTML instead of JSON" errors
    res.status(status).json({
      success: false,
      error: status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
      message,
    });
  });

  // importantly only setup vite in development and after
  // doesn't interfere with the other routes
  const isDev = process.env.NODE_ENV !== "production";
  const embedVite = process.env.EMBED_VITE === "true";

  if (isDev && embedVite) {
    log("Inline Vite dev server enabled via EMBED_VITE=true");
    await setupVite(app, server);
  } else if (!isDev) {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT.
  // Default to 4000 in dev to match Playwright/API clients, 5000 in production/Docker.
  const defaultPort = isProduction ? "5000" : "4000";
  const port = parseInt(process.env.PORT || defaultPort, 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on http://localhost:${port}`);
  });
})();
