import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { MemStorage, DatabaseStorage, type IStorage } from "./storage";
import { currentUser } from "./middleware/auth";
import { runMigrations } from "./migrations/runMigrations";
import { ensureDataRoots } from "./services/localStorageService";
import { globalLimiter } from "./middleware/rateLimiting";

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
} catch {}

const app = express();

// Detect environment
const isProduction = process.env.NODE_ENV === "production";

// Require SESSION_SECRET in production
if (isProduction && !process.env.SESSION_SECRET) {
  console.error('❌ FATAL: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

const dataRoot = path.resolve("data");
ensureDataRoots(dataRoot);
app.use("/data", express.static(dataRoot));

// Serve audio assets (loops, bass samples, etc.)
// Resolve from repo root so packaged assets are available in prod.
const assetsRoot = path.resolve(process.cwd(), "server", "Assets");
app.use("/assets", express.static(assetsRoot));

// Serve stem separation output files
const stemsRoot = path.resolve(process.cwd(), "objects", "stems");
app.use("/api/stems", express.static(stemsRoot, {
  setHeaders: (res, filePath) => {
    // Set correct content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

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
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", process.env.APP_URL || ""].filter(Boolean),
      mediaSrc: ["'self'", "data:", "blob:", "https:"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'"],
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
  
  // Choose storage implementation - prefer internal URL (free on Railway)
  const hasDatabaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  const storage: IStorage = hasDatabaseUrl
    ? new DatabaseStorage()
    : new MemStorage();

  // Attach current user middleware (dev falls back to default user)
  app.use(currentUser(storage));

  const server = await registerRoutes(app, storage);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
  // Default to 4000 in dev to match Playwright/API clients.
  const port = parseInt(process.env.PORT || "4000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on http://localhost:${port}`);
  });
})();
