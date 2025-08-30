import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use simple relative paths that work in both environments
      "@": path.join(__dirname, "client", "src"),
      "@shared": path.join(__dirname, "shared"),
      "@assets": path.join(__dirname, "attached_assets"),
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