// QA-4 prod extras: (1) manifest keys vs dist files, (2) bytes fetched before Menu is interactive (blocking boot), (3) F4-6 boss/xroads under prod, subfolder base.
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { launch } from './harness.mjs';
const DIST = path.resolve('dist');
const man = JSON.parse(fs.readFileSync(path.join(DIST, 'assets/manifest.json'), 'utf8'));
const missing = []; let n = 0;
const walkObj = (o, pre) => { for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object') { if (typeof v.file === 'string') { n++; const cands = [v.file]; const f = path.join(DIST, 'assets', pre === 'audio' ? 'audio' : '', v.file); const ok = fs.existsSync(f) || fs.existsSync(path.join(DIST, 'assets', v.file)); if (!ok) missing.push(`${pre}.${k} -> ${v.file}`); } else walkObj(v, pre + '.' + k); } } };
console.log('manifest top keys', Object.keys(man));
for (const top of Object.keys(man)) if (man[top] && typeof man[top] === 'object') walkObj(man[top], top);
console.log('manifest entries checked', n, 'missing', missing.length, missing.slice(0, 20));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const prefix = '/games/dead-west/';
const srv = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (!p.startsWith(prefix)) { res.writeHead(404); return res.end(); } p = p.slice(prefix.length) || 'index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Content-Length': fs.statSync(f).size }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}${prefix}`;
const g = await launch({ query: '?debug=1&seed=42', name: 'qa4prod', baseUrl: url, quiet: true });
const reqs = [];
const t0 = Date.now();
let menuAt = null;
g.page.on('response', async (r) => { const u = r.url(); let len = 0; try { len = +(r.headers()['content-length'] || 0); } catch {} reqs.push({ t: Date.now() - t0, s: r.status(), u, len }); });
await g.page.reload({ waitUntil: 'domcontentloaded' });
const t1 = Date.now();
await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 120000 });
const menuT = Date.now() - t1; const menuReqs = reqs.filter((r) => r.t <= Date.now() - t0);
const blocking = reqs.slice(); const bBytes = blocking.reduce((a, r) => a + r.len, 0);
console.log(`Menu active after ${menuT}ms; requests so far ${blocking.length}; bytes(content-length) ${(bBytes / 1048576).toFixed(2)} MB`);
const by = {}; for (const r of blocking) { const m = r.u.match(/assets\/(\w+)\//); const k = m ? m[1] : 'code'; by[k] = (by[k] || 0) + r.len; }
console.log('blocking by folder MB', Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v / 1048576).toFixed(2)])));
console.log('biggest blocking', blocking.sort((a, b) => b.len - a.len).slice(0, 8).map((r) => (r.len / 1048576).toFixed(2) + 'MB ' + r.u.split('/').slice(-2).join('/')));
await g.wait(6000);
const after = reqs.length; console.log('requests 6s after menu', after, 'bad', reqs.filter((r) => r.s >= 400).map((r) => r.s + ' ' + r.u));
// F4-6 in prod
await g.startRun();
for (let f = 4; f <= 6; f++) {
  await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.setFloor(f); }, f); await g.wait(2000);
  await g.eval(() => window.__dw.api.bossRoom()); await g.wait(600);
  const b = await g.page.waitForFunction(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss && e.alive); return b ? (b.id || b.constructor.name) : false; }, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  console.log('floor', f, 'boss', b); await g.wait(3000);
}
const bad = reqs.filter((r) => r.s >= 400 && !/favicon/.test(r.u)); console.log('total reqs', reqs.length, 'bad', bad.map((r) => r.s + ' ' + r.u), 'errors', g.errors.slice(0, 5));
await g.close(); srv.close();
