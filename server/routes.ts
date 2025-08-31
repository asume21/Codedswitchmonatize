import type { Express } from "express";
import { createServer } from "http";

export async function registerRoutes(app: Express) {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Music generation endpoint (placeholder)
  app.post("/api/generate-music", (req, res) => {
    res.json({ message: "Music generation endpoint - coming soon" });
  });

  // Create HTTP server
  const server = createServer(app);
  return server;
}
