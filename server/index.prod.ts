import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { MemStorage, DatabaseStorage, type IStorage } from "./storage";
import { currentUser } from "./middleware/auth";
import path from "path";
import fs from "fs";

const app = express();

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
    secret: process.env.SESSION_SECRET || "prod_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production'
    },
  }),
);

console.log(sessionStore ? '✅ Session middleware: PostgreSQL' : '⚠️ Session middleware: MemoryStore (temporary)');

// Standard body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

  // Production static file serving - look in dist/client
  const distPath = path.resolve(process.cwd(), "dist", "client");
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${port}`);
  });
})();
