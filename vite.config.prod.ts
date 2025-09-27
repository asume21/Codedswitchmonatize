import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The most basic Vite config for a standard project structure.
// This assumes the build command is run from the project root.

export default defineConfig({
  // The root of the client-side app is the 'client' directory.
  root: path.resolve(__dirname, 'client'),
  
  plugins: [react()],

  resolve: {
    alias: {
      // Alias '@' to the 'client/src' directory.
      '@': path.resolve(__dirname, 'client', 'src'),
    },
  },

  build: {
    // The output directory for the build will be 'dist/client'.
    outDir: path.resolve(__dirname, 'dist', 'client'),
    emptyOutDir: true,

    // The entry point for the build is 'client/index.html'.
    rollupOptions: {
      input: path.resolve(__dirname, 'client', 'index.html'),
    },
  },
});