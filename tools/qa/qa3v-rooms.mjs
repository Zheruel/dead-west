// QA-3 visual: event rooms, crossroads pocket, vault, secret variants. usage: node qa3v-rooms.mjs [floor]
import { boot, sheet } from './qa3v-lib.mjs';
const floor = Number(process.argv[2] || 2);
const g = await boot('?debug=1&seed=11&unlockall=1');
await g.play('gunslinger');
await g.api((f) => { window.__dw.api.godMode(true); if (f > 1) window.__dw.api.setFloor(f); window.__dw.api.setCoins(40); }, floor);
await g.wait(1500); await g.settle();
await g.eval(() => {
  window.__defs = () => window.__dw.scene.roomMgr.floor.rooms.filter((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
  window.__mk = (type, extra = {}, k = 0) => {
    const m = window.__dw.scene.roomMgr, def = window.__defs()[k % window.__defs().length];
    def._orig = def._orig || 'normal';
    for (const key of ['template', 'mini', 'event', 'variant', 'pocket']) delete def[key];
    Object.assign(def, { type, ...extra });
    delete m.states[def.id];
    m.jump(def.id, null);
    window.__dw.player.teleport(150, 250);
    return def.id;
  };
});
const shots = [];
async function one(tag, fn) {
  try { await g.eval(fn); } catch (e) { console.log('ERR', tag, e.message); }
  await g.wait(1800);
  shots.push(await g.S(`rm_${tag}_a`));
  const info = await g.eval(() => { const s = window.__dw.scene; return { room: s.room && s.room.def && s.room.def.id, n: s.enemies.length, ents: (s.room && s.room.entities ? s.room.entities.length : null) }; });
  console.log(tag, JSON.stringify(info));
}
const ev = ['card_sharp', 'wishing_well', 'gravedigger', 'preacher', 'snake_oil', 'quick_draw'];
for (const e of ev) await one(`ev_${e}`, new Function(`return window.__mk("event",{event:"${e}",template:"event_${e}"})`));
await one('secret_shrine', () => window.__mk('secret', { template: 'secret_shrine', variant: 'shrine' }, 1));
await one('secret_hand', () => window.__mk('secret', { template: 'secret_hand', variant: 'dead_mans_hand' }, 2));
await one('secret_cache', () => window.__mk('secret', { template: 'secret_cache', variant: 'cache' }, 3));
await one('vault', () => window.__mk('supersecret', { template: 'vault_a' }, 4));
await one('xroads', () => window.__dw.api.enterCrossroads());
console.log('errors', JSON.stringify(g.errors));
await g.close();
