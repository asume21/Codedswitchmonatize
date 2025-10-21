/* eslint-disable no-undef */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// Get all node_modules to mark as external
const nodeModulesDir = path.resolve(process.cwd(), 'node_modules');
let external = [];

if (fs.existsSync(nodeModulesDir)) {
  const nodeModules = fs.readdirSync(nodeModulesDir).filter(dir => {
    try {
      return fs.statSync(path.join(nodeModulesDir, dir)).isDirectory();
    } catch {
      return false;
    }
  });
  external = nodeModules.map(mod => mod);
  console.log(`Found ${external.length} node_modules to mark as external`);
} else {
  console.warn('node_modules directory not found, bundling without external modules');
}

esbuild.build({
  entryPoints: ['server/index.prod.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/index.cjs',
  external: external,
  sourcemap: false,
  minify: false,
  logLevel: 'info'
}).catch(() => process.exit(1));
