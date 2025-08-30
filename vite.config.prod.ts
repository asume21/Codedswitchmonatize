import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Get the absolute path to handle different deployment environments
const projectRoot = path.resolve(__dirname);
const clientSrc = path.resolve(projectRoot, "client", "src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": clientSrc,
      "@shared": path.resolve(projectRoot, "shared"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  root: "./client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      external: [],
    },
    target: 'esnext',
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});