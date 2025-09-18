import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicitly resolve the Babel plugin path
const babelPluginPath = path.resolve(__dirname, 'node_modules', '@babel', 'plugin-transform-react-jsx');

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  plugins: [
    react({
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          [babelPluginPath, { runtime: 'automatic' }]
        ]
      }
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['@babel/plugin-transform-react-jsx']
  }
});