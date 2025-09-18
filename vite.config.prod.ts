import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom plugin to explicitly load Babel plugin
const babelPlugin = () => ({
  name: 'babel-plugin-loader',
  async transform(code, id) {
    if (id.includes('@babel/plugin-transform-react-jsx')) {
      const pluginPath = path.resolve(__dirname, 'node_modules', '@babel', 'plugin-transform-react-jsx');
      return require(pluginPath);
    }
    return null;
  }
});

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  plugins: [
    react({
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: 'automatic' }]
        ]
      }
    }),
    babelPlugin()
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