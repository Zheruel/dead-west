// Robustness QA: production build in a PRIVATE outDir (never touches dist/): build -> vite preview -> every registry entry present (enemies, bosses, items),
// play rooms, each boss fight, die, restart; zero console errors. usage: node tools/qa/rb-prod.mjs [--nobuild]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';
import { launch } from './harness.mjs';
const OUT = path.join(os.tmpdir(), 'dw-rb-dist');
const src = (d) => fs.readdirSync(d).map((f) => fs.readFileSync(path.join(d, f), 'utf8')).join('\n');
const enemyIds = [...src('src/enemies/types').matchAll(/registerEnemy\('([a-z_0-9]+)'/g)].map((m) => m[1]);
const itemIds = fs.readdirSync('src/items/defs').map((f) => f.replace(/\.js$/, ''));
if (!process.argv.includes('--nobuild')) { fs.rmSync(OUT, { recursive: true, force: true }); await build({ logLevel: 'warn', build: { outDir: OUT, emptyOutDir: true } }); }
const srv = await preview({ logLevel: 'error', build: { outDir: OUT }, preview: { port: 0, host: '127.0.0.1' } });
const base = `http://127.0.0.1:${srv.httpServer.address().port}/`;
const g = await launch({ baseUrl: base, query: '?debug=1&seed=9', name: 'rb-prod', quiet: true });
await g.startRun();
const res = await g.eval(async (enemyIds, itemIds) => {
  const a = window.__dw.api, p = window.__dw.player, s = window.__dw.scene, out = { badEnemies: [], badItems: [], bosses: [] };
  a.godMode(true);
  for (const id of enemyIds) { try { const e = a.spawn(id); if (!e || e.id !== id) out.badEnemies.push(id); } catch (e) { out.badEnemies.push(id + ':' + e.message); } }
  await new Promise((r) => setTimeout(r, 1500)); a.killAll();
  for (const id of itemIds) { try { a.giveItem(id); if (!p.items.includes(id) && !(p.active && p.active.id === id)) out.badItems.push(id); } catch (e) { out.badItems.push(id + ':' + e.message); } }
  for (const f of [1, 2, 3]) {
    a.setFloor(f); await new Promise((r) => setTimeout(r, 800));
    a.give(9); a.input({ move: { x: 0.3, y: 0.3 }, aim: { x: 1, y: 0 }, fire: true });
    await new Promise((r) => setTimeout(r, 1500));
    a.bossRoom(); await new Promise((r) => setTimeout(r, 6000));
    const boss = s.enemies.find((e) => e.isBoss);
    out.bosses.push({ floor: f, room: s.room.type, boss: boss ? boss.id : null, hp: boss ? Math.round(boss.hp) : null, cut: s.cutscene });
    a.killAll(); await new Promise((r) => setTimeout(r, 4500));
  }
  a.input(null);
  return out;
}, enemyIds, itemIds);
console.log(JSON.stringify(res));
const bad = g.logs.filter((l) => /not implemented|warn|error/i.test(l));
console.log('enemies', enemyIds.length, 'items', itemIds.length, 'suspicious logs', bad.slice(0, 5));
await g.eval(() => { window.__dw.player.shieldLeft = 0; window.__dw.api.godMode(false); window.__dw.api.die(); });
await g.page.waitForFunction(() => window.__game.scene.isActive('End'), { timeout: 30000 }).then(() => console.log('End reached')).catch(() => console.log('no End'));
await g.wait(1200); await g.tap('KeyR', 80); await g.wait(2500);
console.log('restart', await g.eval(() => window.__game.scene.isActive('Game')), 'ERRORS', g.errors.length, g.errors.slice(0, 5));
await g.close(); await srv.close();
