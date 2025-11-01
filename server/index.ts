import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { MemStorage, DatabaseStorage, type IStorage } from "./storage";
import { setupSnakeWS } from "./services/snake-ws";
import { currentUser } from "./middleware/auth";

// Load environment variables from .env file
import { config } from 'dotenv';
config();

// Force rebuild - PostgreSQL sessions v2

const app = express();

// Trust Railway proxy for secure cookies
app.set('trust proxy', 1);

// Stripe webhook must receive the raw body for signature verification.
// Mount this BEFORE json/urlencoded parsers.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Sessions with PostgreSQL - properly configured
const PgSession = connectPgSimple(session);

let sessionStore;
console.log('🔍 DEBUG: DATABASE_URL exists?', !!process.env.DATABASE_URL);
console.log('🔍 DEBUG: DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
const hasDatabase = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0;

if (hasDatabase) {
  console.log('🔄 Initializing PostgreSQL session store...');
  try {
    sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60, // Prune expired sessions every 60 seconds
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
    secret: process.env.SESSION_SECRET || "dev_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "none", // Allow cross-site cookies
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: true, // HTTPS required on Railway
      httpOnly: true,
      path: '/',
    },
    proxy: true,
    name: 'codedswitch.sid', // Custom session name
  }),
);

console.log('🍪 Session cookie config: sameSite=none, secure=true, httpOnly=true');

console.log(sessionStore ? '✅ Session middleware: PostgreSQL' : '⚠️ Session middleware: MemoryStore (temporary)');

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
  if (isDev) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || (isDev ? "3000" : "5000"), 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on http://localhost:${port}`);
  });
})();
