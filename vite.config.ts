import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

export default defineConfig({
  root: './client',
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
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime"),
    },
    dedupe: ["react", "react-dom"],
  },
  envDir: __dirname,
  server: {
    port: 5001,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
      '/data': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['@babel/plugin-transform-react-jsx'],
    // Audit 2026-04-30 fix: Vite's pre-bundle dep-scanner runs in esbuild
    // and doesn't see Vite's resolve.alias. When it hits `@shared/creditCosts`
    // it treats `@shared` as an npm scope and fails to find it, logging:
    //   (!) Failed to run dependency scan. Skipping dependency pre-bundling.
    // Teach the scanner the same alias so it can resolve local source paths.
    esbuildOptions: {
      plugins: [
        {
          name: 'resolve-shared-alias',
          setup(build) {
            build.onResolve({ filter: /^@shared\// }, (args) => {
              const rel = args.path.replace(/^@shared\//, '');
              const base = path.resolve(__dirname, 'shared', rel);
              for (const candidate of [
                base,
                `${base}.ts`,
                `${base}.tsx`,
                path.join(base, 'index.ts'),
                path.join(base, 'index.tsx'),
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
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('/node_modules/')) return undefined;

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          if (
            normalizedId.includes('/node_modules/@radix-ui/') ||
            normalizedId.includes('/node_modules/lucide-react/')
          ) {
            return 'ui-vendor';
          }

          if (
            normalizedId.includes('/node_modules/tone/') ||
            normalizedId.includes('/node_modules/standardized-audio-context/')
          ) {
            return 'audio-vendor';
          }

          if (
            normalizedId.includes('/node_modules/@tanstack/') ||
            normalizedId.includes('/node_modules/wouter/')
          ) {
            return 'app-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
});
