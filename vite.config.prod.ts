import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  plugins: [
    react({
      jsxRuntime: 'automatic',
      babel: {
        presets: [
          ["@babel/preset-react", { runtime: 'automatic' }],
          ["@babel/preset-env", { targets: { node: 'current' } }],
          "@babel/preset-typescript"
        ],
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: 'automatic' }]
        ]
      }
    })
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