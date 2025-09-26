import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Fix Render's path resolution issue
const currentDir = process.cwd();
const getCorrectPaths = () => {
  
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
      isRender: true,
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
      isRender: false,
    };
  }
};

const paths = getCorrectPaths();
console.log('VITE CONFIG: paths.root =', paths.root);
console.log('VITE CONFIG: about to use rollupOptions.input =', path.resolve(paths.root, "index.html"));

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
    rollupOptions: {
      input: path.resolve(currentDir, "client", "index.html"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});