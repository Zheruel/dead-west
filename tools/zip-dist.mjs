// npm run zip -> builds (if dist/ is missing or --build is passed) and zips dist/ into dead-west-web.zip with index.html at the archive root
// (what itch.io / any static host wants). Uses the system `zip` binary; no extra dependencies.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'dead-west-web.zip');
if (process.argv.includes('--build') || !fs.existsSync(path.join(dist, 'index.html'))) execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });
fs.rmSync(out, { force: true });
try { execFileSync('zip', ['-r', '-X', '-q', out, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: dist, stdio: 'inherit' }); }
catch (e) { console.error('zip failed (is the `zip` binary installed?)', e.message); process.exit(1); }
console.log(`wrote ${path.relative(root, out)} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
