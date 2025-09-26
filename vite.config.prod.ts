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

let viteRoot = paths.root;
let viteInput = path.resolve(paths.root, "index.html");
if (process.env.RENDER === 'true' || currentDir.includes('/opt/render/project')) {
  viteRoot = "/opt/render/project/src/client";
  viteInput = "/opt/render/project/src/client/index.html";
}
console.log('VITE CONFIG: viteRoot =', viteRoot);
console.log('VITE CONFIG: viteInput =', viteInput);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": paths.clientSrc,
      "@shared": paths.shared,
      "@assets": paths.assets,
    },
  },
  root: viteRoot,
  build: {
    outDir: paths.outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: viteInput,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});