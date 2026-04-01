import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { MemStorage, DatabaseStorage, type IStorage } from "./storage";
import { currentUser } from "./middleware/auth";
import { globalLimiter } from "./middleware/rateLimiting";
import path from "path";
import fs from "fs";
import { ensureDataRoots } from "./services/localStorageService";

// Require SESSION_SECRET in production
if (!process.env.SESSION_SECRET) {
  console.error('❌ FATAL: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

const app = express();

// Trust proxy for secure cookies behind Railway/load balancers
app.set('trust proxy', 1);

// Security headers
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
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: "deny" },
  xssFilter: true,
}));

const dataRoot = path.resolve("data");
ensureDataRoots(dataRoot);
app.use("/data", express.static(dataRoot));

// Stripe webhook must receive the raw body for signature verification.
// Mount this BEFORE json/urlencoded parsers.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Sessions with PostgreSQL - properly configured
const PgSession = connectPgSimple(session);

let sessionStore;
const hasDatabase = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0;

if (hasDatabase) {
  console.log('🔄 Initializing PostgreSQL session store...');
  try {
    // Force rebuild - PostgreSQL sessions v2 + PUBLIC URL fix
    sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
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
    secret: process.env.SESSION_SECRET,
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
  // Choose storage implementation
  const storage: IStorage = process.env.DATABASE_URL
    ? new DatabaseStorage()
    : new MemStorage();

  // Attach current user middleware
  app.use(currentUser(storage));

  const server = await registerRoutes(app, storage);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
    "/music-studio": "/studio",
    "/song-uploader": "/studio",
    "/beat-studio": "/studio",
    "/melody-composer": "/studio",
    "/unified-studio": "/studio",
    "/daw-layout": "/studio",
    "/flow": "/studio",
    "/code-translator": "/studio",
    "/codebeat-studio": "/studio",
    "/mix-studio": "/studio",
    "/pro-console": "/studio",
    "/midi-controller": "/studio",
    "/advanced-sequencer": "/studio",
    "/wavetable-oscillator": "/studio",
    "/pack-generator": "/studio",
    "/song-structure": "/studio",
    "/pro-audio": "/studio",
    "/codebeat-studio-direct": "/studio",
    "/piano-roll": "/studio",
    "/granular-engine": "/studio",
    "/mid-controller": "/studio",
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

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 4000 if not specified to align with local API clients.
  const port = parseInt(process.env.PORT || '4000', 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${port}`);
  });
})();
