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
  app.use(express.static(clientPath));
  
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

export function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
