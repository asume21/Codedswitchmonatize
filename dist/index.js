// server/index.prod.ts
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
