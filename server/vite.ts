import type { Express } from "express";
import { createServer } from "vite";
import express from "express";
import path from "path";

export async function setupVite(app: Express, server: any) {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
    root: path.resolve("client"),
  });

  app.use(vite.ssrFixStacktrace);
  app.use(vite.middlewares);
}

export function serveStatic(app: Express) {
  const clientPath = path.resolve("dist/client");
  const assetsPath = path.join(clientPath, "assets");

  // Serve hashed build assets with aggressive caching.
  // IMPORTANT: do not let missing /assets/* requests fall through to the SPA index.html.
  app.use(
    "/assets",
    express.static(assetsPath, {
      immutable: true,
      maxAge: "1y",
      fallthrough: false,
    }),
  );
  
  // Serve static files from the dist/client directory
  app.use(express.static(clientPath, {
    index: false, // Don't serve index.html for directories
    fallthrough: true, // Continue to next middleware if file not found
    setHeaders: (res, filePath) => {
      // Ensure index.html is never cached, so it always references the current hashed bundles.
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  }));
  
  // Handle client-side routing - return index.html for all non-API routes
  app.get(/^(?!\/api\/|\/assets\/).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(clientPath, 'index.html'), (err) => {
      if (err) {
        res.status(500).send('Error loading the application');
      }
    });
  });
}

export function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
