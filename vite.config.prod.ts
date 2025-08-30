import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Debug function to understand Render's directory structure
const debugPaths = () => {
  const currentDir = process.cwd();
  const dirname = __dirname;
  console.log("🔍 Current working directory:", currentDir);
  console.log("🔍 __dirname:", dirname);
  
  // Check if we're in Render's environment
  if (currentDir.includes('/opt/render/project')) {
    console.log("🚀 Detected Render environment");
    // Render seems to expect files in a different structure
    return {
      clientSrc: path.resolve(currentDir, "client", "src"),
      shared: path.resolve(currentDir, "shared"),
      assets: path.resolve(currentDir, "attached_assets"),
    };
  } else {
    console.log("🏠 Detected local environment");
    return {
      clientSrc: path.resolve(__dirname, "client", "src"),
      shared: path.resolve(__dirname, "shared"),
      assets: path.resolve(__dirname, "attached_assets"),
    };
  }
};

const paths = debugPaths();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": paths.clientSrc,
      "@shared": paths.shared,
      "@assets": paths.assets,
    },
  },
  root: "./client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});