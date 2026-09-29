// Production-build check: `npm run test:prod` (builds dist/ first if missing; `--build` forces a rebuild).
// Serves dist/ two ways (vite preview at "/", and a plain static server under a nested folder "/games/dead-west/" to prove the relative base works),
// then in headless Chrome: boots the menu, starts a run, visits each boss room (real boss spawns), and asserts
//   - zero console errors / failed requests, every asset request returned 200,
//   - script + asset URLs carry cache-busters (hashed bundle names, ?v=<manifest hash> on assets),
//   - dev-only helper files (*.preview.png, *.meta.json, *.image.json, *.audio.json) are absent from dist/.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { preview } from 'vite';
import { launch } from './harness.mjs';

const ROOT = path.resolve('.');
const DIST = path.join(ROOT, 'dist');
if (process.argv.includes('--build') || !fs.existsSync(path.join(DIST, 'index.html'))) execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });

let failed = 0;
const ok = (name, cond, extra = '') => { if (!cond) failed++; console.log(cond ? 'PASS' : 'FAIL', name, extra); };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.md': 'text/markdown' };
function staticServer(prefix) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (!p.startsWith(prefix)) { res.writeHead(404); return res.end(); }
      p = p.slice(prefix.length) || 'index.html';
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(DIST, p);
      if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}${prefix}`, close: () => srv.close() }));
  });
}

async function checkAt(label, baseUrl) {
  console.log(`\n== ${label}: ${baseUrl}`);
  const g = await launch({ query: '?debug=1&seed=42', name: 'prod', baseUrl, quiet: true });
  const reqs = [];
  g.page.on('response', (r) => reqs.push([r.status(), r.url()]));
  try {
    await g.page.reload({ waitUntil: 'domcontentloaded' }); // re-navigate with the response listener attached
    await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 120000 });
    await g.wait(800);
    await g.shot(`prod-menu-${label}`);
    await g.startRun();
    const st = await g.eval(() => window.__dw.api.state());
    ok(`${label}: run starts on floor 1`, st.floor === 1 && !st.dead, JSON.stringify({ floor: st.floor, room: st.roomType }));
    for (let f = 1; f <= 3; f++) {
      await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.setFloor(f); }, f);
      await g.wait(1500);
      await g.eval(() => window.__dw.api.bossRoom());
      await g.wait(500);
      const boss = await g.page.waitForFunction(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss && e.alive); return b ? b.id || b.constructor.name : false; }, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
      ok(`${label}: floor ${f} boss spawns`, !!boss, String(boss));
      await g.wait(2500); // let the intro card finish
      await g.shot(`prod-boss${f}-${label}`);
    }
    await g.eval(() => window.__dw.api.die());
    await g.page.waitForFunction(() => window.__game.scene.isActive('End'), { timeout: 20000 }).then(() => ok(`${label}: death -> End scene`, true)).catch(() => ok(`${label}: death -> End scene`, false));
    const bad = reqs.filter(([s, u]) => s >= 400 && !/favicon/.test(u));
    ok(`${label}: no failed requests`, bad.length === 0, JSON.stringify(bad.slice(0, 5)));
    const own = reqs.filter(([, u]) => u.startsWith(baseUrl));
    ok(`${label}: bundle is content-hashed`, own.some(([, u]) => /assets\/index-[\w-]{6,}\.js/.test(u)) && own.some(([, u]) => /assets\/phaser-[\w-]{6,}\.js/.test(u)));
    const assetReqs = own.filter(([, u]) => /assets\/(sprites|images|audio)\//.test(u));
    ok(`${label}: assets carry ?v= cache-buster`, assetReqs.length > 50 && assetReqs.every(([, u]) => /\?v=[0-9a-f]{6,}/.test(u)), `${assetReqs.length} asset requests`);
    ok(`${label}: zero console errors`, g.errors.length === 0, JSON.stringify(g.errors.slice(0, 5)));
  } catch (e) { ok(`${label}: no exception`, false, e.stack || e.message); }
  await g.close();
}

// dev-only helper files must not ship
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const junk = walk(DIST).filter((f) => /\.(preview\.png|meta\.json|image\.json|audio\.json)$/.test(f) || /\.DS_Store$/.test(f));
ok('dist has no dev-only helper files', junk.length === 0, junk.slice(0, 3).join(' '));
const mb = walk(DIST).reduce((n, f) => n + fs.statSync(f).size, 0) / 1048576;
console.log(`dist size: ${mb.toFixed(1)} MB`);

const pv = await preview({ root: ROOT, logLevel: 'error', preview: { port: 0, host: '127.0.0.1' } });
await checkAt('preview', `http://127.0.0.1:${pv.httpServer.address().port}/`);
await pv.close();
const ss = await staticServer('/games/dead-west/');
await checkAt('subfolder', ss.url);
ss.close();

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall production checks passed');
process.exit(failed ? 1 : 0);
