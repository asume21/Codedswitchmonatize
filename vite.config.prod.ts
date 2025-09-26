import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Fix Render's path resolution issue
const getCorrectPaths = () => {
  const currentDir = process.cwd();
  
  // Render runs from /opt/render/project/src but files are actually in /opt/render/project
  if (currentDir.includes('/opt/render/project')) {
    console.log("🚀 Detected Render environment - using correct paths");
    // Go up one directory to find the actual project root
    const projectRoot = path.resolve(currentDir, "..");
    return {
      clientSrc: path.resolve(projectRoot, "client", "src"),
      shared: path.resolve(projectRoot, "shared"),
      assets: path.resolve(projectRoot, "attached_assets"),
      root: path.resolve(projectRoot, "client"),
      outDir: path.resolve(projectRoot, "dist", "client"),
      projectRoot: projectRoot,
    };
  } else {
    console.log("🏠 Detected local environment");
    return {
      clientSrc: path.resolve(__dirname, "client", "src"),
      shared: path.resolve(__dirname, "shared"),
      assets: path.resolve(__dirname, "attached_assets"),
      root: "./client",
      outDir: "../dist/client",
      projectRoot: __dirname,
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
  root: paths.root,
  build: {
    outDir: paths.outDir,
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});