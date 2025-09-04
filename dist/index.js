// server/index.prod.ts
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = join(__filename, "..");
var PORT = process.env.PORT || 3e3;
var clientDir = join(__dirname, "client");
var mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
var server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  let filePath = req.url === "/" ? "/index.html" : req.url || "/index.html";
  if (filePath.startsWith("/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  const fullPath = join(clientDir, filePath);
  if (existsSync(fullPath)) {
    const ext = extname(fullPath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    try {
      const content = readFileSync(fullPath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch (error) {
      res.writeHead(500);
      res.end("Server Error");
    }
  } else {
    const indexPath = join(clientDir, "index.html");
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  }
});
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
