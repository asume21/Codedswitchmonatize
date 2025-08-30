import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Handle different deployment environments (local vs Render)
const isProduction = process.env.NODE_ENV === 'production';
const projectRoot = path.resolve(__dirname);

// For Render deployment, use relative paths that work with their file structure
const getClientSrcPath = () => {
  if (isProduction) {
    // For Render: Use relative path that works with their directory structure
    return path.resolve(__dirname, "client", "src");
  }
  // For local development
  return path.resolve(projectRoot, "client", "src");
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": getClientSrcPath(),
      "@shared": path.resolve(projectRoot, "shared"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // Add more robust module resolution
    preserveSymlinks: false,
  },
  root: "./client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      // Ensure all imports are resolved correctly
      onwarn(warning, warn) {
        // Suppress certain warnings in production
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
    target: 'esnext',
    sourcemap: false, // Disable sourcemaps for faster builds
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
    // Force inclusion of commonly used modules
    force: true,
  },
  // Additional configuration for deployment environments
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});