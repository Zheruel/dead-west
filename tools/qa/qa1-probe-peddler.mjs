// Q1 repro: leave a shop while the peddler is mid-line via RoomManager.jump (debug teleport/bossRoom) with fixed-step sim -> TypeError in PeddlerSpeech.update
import { boot } from './items-lib.mjs';
const g = await boot('qa1-ped', '?debug=1&seed=21&char=preacher&mode=hell');
await g.eval(() => { window.__t = 100000; window.__ff = (n) => { const game = window.__game; for (let i = 0; i < n; i++) { window.__t += 16.667; game.step(window.__t, 16.667); } }; window.__dw.api.godMode(true); });
const hits = [];
for (let k = 10; k < 260; k += 10) {
  const r = await g.eval((k) => { const a = window.__dw.api; try { a.jump('shop'); window.__ff(k); a.jump('r1'); window.__ff(20); } catch (e) { return String(e.stack || e).slice(0, 300); } return null; }, k);
  if (r) hits.push([k, r]);
}
console.log('hits', hits.length); for (const h of hits.slice(0, 3)) console.log(h[0], h[1]);
console.log('errors', g.errors.length);
await g.close(); process.exit(0);
