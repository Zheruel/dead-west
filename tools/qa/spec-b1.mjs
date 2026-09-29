import { boot } from './spec-lib.mjs';
import { readFileSync } from 'node:fs';
const g = await boot('?debug=1&seed=42');
const ids = ['coyote','rattlesnake','tumbleweed','tumbleweed_mini','outlaw','buzzard','possessed','skeleton','dynamiter','ghost','scarecrow','crow','miner','bat','mole','coffin'];
const r = await g.eval((ids) => {
  const sc = window.__dw.scene, api = window.__dw.api, out = {};
  api.godMode(true);
  // use boss room-less room: current room (start). spawn each per floor
  for (const f of [1, 2, 3]) {
    for (const id of ids) {
      const e = api.spawn(id, 700, 500, { floor: f });
      out[`${id}@${f}`] = [e.maxHp, e.constructor.name, !!e.sprite && e.spriteKey, e.sprite && e.sprite.texture && e.sprite.texture.key !== '__MISSING' && e.sprite.frame.name];
      e.destroy();
    }
  }
  const c = api.spawn('outlaw', 700, 500, { floor: 1, cursed: true });
  out.cursed = [c.maxHp, !!c.aura];
  const has = {};
  for (const id of ids) has[id] = window.__game.textures.exists('enemy_' + id);
  out.hasTex = has;
  return out;
}, ids);
for (const [k, v] of Object.entries(r)) console.log(k, JSON.stringify(v));
console.log('errors', g.errors);
await g.close();
