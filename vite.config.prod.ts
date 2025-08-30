import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Fix Render's path resolution issue
const getCorrectPaths = () => {
  const currentDir = process.cwd();

  // Render runs from /opt/render/project/src but files are actually in /opt/render/project
  if (currentDir.includes('/opt/render/project/src')) {
    console.log("🚀 Detected Render environment - using correct paths");
    // Go up one directory to find the actual project root
    const projectRoot = path.resolve(currentDir, "..");
    console.log("Project root:", projectRoot);
    const clientSrc = path.resolve(projectRoot, "client", "src");
    console.log("Client src path:", clientSrc);
    return {
      clientSrc: clientSrc,
      shared: path.resolve(projectRoot, "shared"),
      assets: path.resolve(projectRoot, "attached_assets"),
    };
  } else {
    console.log("🏠 Detected local environment");
    const clientSrc = path.resolve(__dirname, "client", "src");
    console.log("Client src path:", clientSrc);
    return {
      clientSrc: clientSrc,
      shared: path.resolve(__dirname, "shared"),
      assets: path.resolve(__dirname, "attached_assets"),
    };
  }
};

const paths = getCorrectPaths();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": paths.clientSrc,
      "@shared": paths.shared,
      "@assets": paths.assets,
    },
  },
  build: {
    outDir: "./dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});