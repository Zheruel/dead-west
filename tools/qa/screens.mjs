// Regenerates the curated screenshot set in art/screens/ (menu, one combat room per floor, 3 bosses, HUD with items, shop, death, chapter complete).
//   node tools/qa/screens.mjs      (~1 min; real-time rendering, no debug overlay)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './harness.mjs';
const OUT = 'art/screens';
fs.mkdirSync(OUT, { recursive: true });
const g = await launch({ query: '?seed=7', name: 'screens', quiet: true });
const shot = async (name) => { await g.page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const api = (fn, ...a) => g.eval(fn, ...a);

await g.wait(2500);
await shot('01_menu');
await g.startRun();
await api(() => window.__dw.api.godMode(true));
await g.wait(3500); // let the floor-intro card fade

async function combat(floor, name) {
  await api((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); }, floor);
  await g.wait(2500);
  await api(() => { const w = window.__dw; const r = w.floor.rooms.filter((x) => x.type === 'normal' && x.dist >= 2)[0] || w.floor.rooms.find((x) => x.type === 'normal'); w.api.teleport(r.id); });
  await g.wait(2600); // door slide + wave telegraph
  await api(() => window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true }));
  await g.wait(900);
  await shot(name);
  await api(() => { window.__dw.api.input(null); window.__dw.api.killAll(); });
}
async function boss(floor, name, settle = 4200) {
  await api((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); }, floor);
  await g.wait(2500);
  await api(() => window.__dw.api.bossRoom());
  await g.page.waitForFunction(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b && b.active; }, { timeout: 30000 }).catch(() => {});
  await api(() => { const p = window.__dw.player; p.teleport(720, 800); window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true }); }); // fire sideways: shots at the boss would catch its white hit-flash frame
  await g.wait(settle);
  await shot(name);
  await api(() => { window.__dw.api.input(null); window.__dw.api.teleport(window.__dw.floor.startId); }); // leave (do not kill: the death sequence would leak into the next room)
}
await combat(1, '02_floor1_combat');
await api(() => { const a = window.__dw.api; a.give(12); for (const i of ['spurs', 'hollow_point', 'whiskey_bottle', 'spirit_lantern']) a.giveItem(i); });
await g.wait(900);
await shot('08_hud_items'); // pickup banner + relic strip + hearts + active slot
await g.wait(10500); // let the banner queue drain
await boss(1, '05_boss_cascabel');
await combat(2, '03_floor2_combat');
await boss(2, '06_boss_grimm', 6500);
await combat(3, '04_floor3_combat');
await boss(3, '07_boss_undertaker');

// shop
await api(() => { const w = window.__dw; w.api.setFloor(1); });
await g.wait(2500);
await api(() => { const w = window.__dw; const r = w.floor.rooms.find((x) => x.type === 'shop'); if (r) w.api.teleport(r.id); });
await g.wait(2500);
await api(() => window.__dw.player.teleport(720, 760));
await g.wait(600);
await shot('09_shop');

// death poster, then chapter-complete poster in a fresh run
await api(() => { const s = window.__dw.scene; s.run.kills = 23; s.run.roomsCleared = 6; s.run.bossesKilled = 1; s.run.floor = 2; s.run.time = 754; s.run.damageTaken = 9; window.__dw.api.die(); });
await g.wait(7500);
await shot('10_death');
await g.tap('KeyR', 80);
await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player && !window.__dw.player.dead, { timeout: 30000 });
await g.wait(1500);
await api(() => { const w = window.__dw, s = w.scene; for (const i of ['spurs', 'hollow_point', 'sawed_off', 'spirit_lantern']) w.api.giveItem(i); Object.assign(s.run, { kills: 96, roomsCleared: 27, bossesKilled: 3, floor: 3, time: 1493, damageTaken: 14, won: true }); s.endRun('complete'); });
await g.wait(6000);
await shot('11_chapter_complete');
console.log('errors', g.errors);
await g.close();
try { execFileSync('sh', ['-c', `pngquant --quality 70-95 --force --ext .png --skip-if-larger ${OUT}/*.png`]); console.log('optimised with pngquant'); } catch { console.log('pngquant not available: screenshots left unoptimised (~2.5 MB each)'); }
process.exit(g.errors.length ? 1 : 0);
