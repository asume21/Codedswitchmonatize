import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const repoRoot = path.resolve(__dirname, "..");

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
      "@shared": path.resolve(repoRoot, "./shared"),
      "@assets": path.resolve(repoRoot, "./attached_assets"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: ['@babel/plugin-transform-react-jsx'],
    esbuildOptions: {
      plugins: [
        {
          name: "resolve-shared-alias",
          setup(build) {
            build.onResolve({ filter: /^@shared\// }, (args) => {
              const rel = args.path.replace(/^@shared\//, "");
              const base = path.resolve(repoRoot, "shared", rel);
              for (const candidate of [
                base,
                `${base}.ts`,
                `${base}.tsx`,
                path.join(base, "index.ts"),
                path.join(base, "index.tsx"),
              ]) {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                  return { path: candidate };
                }
              }
              return null;
            });
          },
        },
      ],
    },
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
