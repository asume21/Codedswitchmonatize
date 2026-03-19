import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }]
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: ['@babel/plugin-transform-react-jsx']
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'analysisWorklet'
            ? 'organism/worklets/analysis-worklet-processor.js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
});
