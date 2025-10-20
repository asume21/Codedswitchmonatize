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

const app = express();

// Stripe webhook must receive the raw body for signature verification.
// Mount this BEFORE json/urlencoded parsers.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Sessions with PostgreSQL store (production-ready)
const PgSession = connectPgSimple(session);

// Determine SSL configuration based on environment
const getDatabaseSSL = () => {
  if (process.env.NODE_ENV !== 'production') {
    return false; // No SSL in development
  }
  // In production, use SSL but handle Railway's self-signed certs
  // Only disable rejectUnauthorized if DATABASE_URL contains railway.app
  const isRailway = process.env.DATABASE_URL?.includes('railway.app');
  return isRailway ? { rejectUnauthorized: false } : true;
};

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ CRITICAL: DATABASE_URL is not set! Sessions will not work properly.');
  console.error('Please set DATABASE_URL in your environment variables.');
} else {
  console.log('✅ DATABASE_URL is configured');
}

try {
  const sessionStore = new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      ssl: getDatabaseSSL()
    },
    tableName: 'session',
    createTableIfMissing: true
  });

  // Log when session store is ready
  sessionStore.on('connect', () => {
    console.log('✅ PostgreSQL session store connected successfully');
  });

  sessionStore.on('error', (error) => {
    console.error('❌ PostgreSQL session store error:', error);
  });

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "dev_session_secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === 'production' // HTTPS only in production
      },
    }),
  );

  console.log('✅ Session middleware configured with PostgreSQL store');
} catch (error) {
  console.error('❌ Failed to initialize PostgreSQL session store:', error);
  console.error('Falling back to default MemoryStore (NOT RECOMMENDED FOR PRODUCTION)');
  
  // Fallback to memory store with warning
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev_session_secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production'
      },
    }),
  );
}

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
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on http://localhost:${port}`);
  });
})();
