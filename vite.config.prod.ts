import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
          '@babel/plugin-transform-runtime'
        ]
      }
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "client/src")
      },
      {
        find: "@shared",
        replacement: path.resolve(__dirname, "shared")
      }
    ]
  },
  root: "./client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    sourcemap: true, // Enable sourcemaps for debugging
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          vendor: ['@tanstack/react-query', 'wouter'],
        },
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
    },
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      'wouter',
      'react/jsx-runtime',
    ],
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});