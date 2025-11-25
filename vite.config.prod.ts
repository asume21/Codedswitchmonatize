import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Production Vite config with optimizations
export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
    },
  },

  build: {
    outDir: path.resolve(__dirname, 'dist', 'client'),
    emptyOutDir: true,
    
    // Minification
    minify: 'esbuild',
    target: 'es2020',
    
    // Code splitting configuration
    rollupOptions: {
      input: path.resolve(__dirname, 'client', 'index.html'),
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Core React
          'react-vendor': ['react', 'react-dom'],
          // Audio libraries (heavy)
          'audio-vendor': ['tone', 'soundfont-player'],
          // UI components
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          // Query/state management
          'data-vendor': ['@tanstack/react-query', 'wouter'],
        },
        // Chunk file naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
    
    // Source maps for debugging (optional in prod)
    sourcemap: false,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['tone'], // Tone.js has issues with pre-bundling
  },
});