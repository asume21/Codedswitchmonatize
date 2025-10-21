/* eslint-disable no-undef */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// Get all node_modules to mark as external
const nodeModulesDir = path.join(process.cwd(), 'node_modules');
const nodeModules = fs.readdirSync(nodeModulesDir).filter(dir => {
  return fs.statSync(path.join(nodeModulesDir, dir)).isDirectory();
});

// Mark all node_modules as external to prevent bundling
const external = nodeModules.map(mod => mod);

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
