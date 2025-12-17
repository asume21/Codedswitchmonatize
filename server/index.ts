import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { MemStorage, DatabaseStorage, type IStorage } from "./storage";
import { setupSnakeWS } from "./services/snake-ws";
import { currentUser } from "./middleware/auth";
import { runMigrations } from "./migrations/runMigrations";
import { ensureDataRoots } from "./services/localStorageService";

// Load environment variables from .env file
import { config } from 'dotenv';
config();

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

// Trust proxy for secure cookies (Railway, Replit, etc.)
app.set('trust proxy', 1);

// Enable CORS for development (client on different port)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('replit'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
const hasDatabase = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0;

if (hasDatabase) {
  try {
    sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
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

// Standard body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Domain-based landing redirect: make snake.codedswitch.com land on /snake-io
app.use((req, res, next) => {
  try {
    const host = (req.headers.host || '').toLowerCase();
    if (
      req.method === 'GET' &&
      (req.path === '/' || req.path === '') &&
      (host.startsWith('snake.') || host === 'snake.localhost')
    ) {
      return res.redirect(302, '/snake-io');
    }
  } catch {}
  next();
});

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
  
  // Choose storage implementation
  const storage: IStorage = process.env.DATABASE_URL
    ? new DatabaseStorage()
    : new MemStorage();

  // Attach current user middleware (dev falls back to default user)
  app.use(currentUser(storage));

  const server = await registerRoutes(app, storage);
  // Attach multiplayer WebSocket server (Snake IO)
  setupSnakeWS(server);

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
