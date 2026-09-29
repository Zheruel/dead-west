import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Build only: drop dev-only files from dist/assets (contact-sheet previews, per-asset meta/image json; the game reads manifest.json only).
const stripDevAssets = () => {
  let out = 'dist';
  return {
  name: 'dw-strip-dev-assets',
  apply: 'build',
  configResolved(c) { out = path.resolve(c.root, c.build.outDir); },
  closeBundle() {
    const walk = (d) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(preview\.png|meta\.json|image\.json|audio\.json)$/.test(e.name) && !/manifest\.json$/.test(e.name)) fs.rmSync(p);
    } };
    walk(path.join(out, 'assets'));
  },
  };
};

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400, // phaser alone is ~1.2 MB minified; it lives in its own long-cached vendor chunk
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) } },
  },
  plugins: [stripDevAssets()],
});
