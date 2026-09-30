// QA-3 v: chapter-1 readability with modifiers + new hazard templates. shots ch1_mod_<id>_f<floor>.png, ch1_tpl_<id>.png
import { boot, sheet } from './qa3v-lib.mjs';
const g = await boot('?debug=1&seed=21&unlockall=1');
await g.play('gunslinger');
await g.eval(() => {
  window.__dw.api.godMode(true);
  window.__defs = () => window.__dw.scene.roomMgr.floor.rooms.filter((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
  window.__force = (o, k = 0) => {
    const m = window.__dw.scene.roomMgr, def = window.__defs()[k % window.__defs().length];
    def._orig = def._orig || 'normal';
    for (const key of ['mod']) delete def[key];
    Object.assign(def, o);
    delete m.states[def.id];
    m.jump(def.id, null);
    return def.id;
  };
});
async function shot(tag, o, floorNum, enemies, k) {
  await g.eval((f) => { const a = window.__dw.api; if (f !== window.__dw.scene.floorNum) a.setFloor(f); }, floorNum);
  await g.wait(1800); await g.settle();
  const id = await g.eval((o, k) => window.__force(o, k), o, k);
  await g.wait(2500);
  await g.eval((en) => { const a = window.__dw.api, p = window.__dw.player; en.forEach((e, i) => a.spawn(e, p.x + 220 + 90 * (i % 2), p.y - 140 + 100 * i, {})); a.godMode(true); }, enemies);
  await g.wait(2500);
  const st = await g.eval(() => { const s = window.__dw.scene; return { fps: Math.round(s.game.loop.actualFps), mod: s.room.def.mod, tpl: s.room.def.template, n: s.enemies.length }; });
  console.log(tag, id, JSON.stringify(st));
  await g.S(tag);
}
const F1 = ['coyote', 'outlaw', 'rattlesnake'];
for (const m of ['dust_storm', 'fog', 'darkness', 'blood_moon', 'hellfire', 'stampede', 'rockfall', 'lurch']) await shot(`ch1_mod_${m}_f1`, { mod: m }, 1, F1, 0);
for (const [t, f] of [['f1_17', 1], ['f1_18', 1], ['f2_17', 2], ['f3_17', 3]]) await shot(`ch1_tpl_${t}`, { template: t }, f, f === 1 ? ['coyote', 'outlaw'] : ['outlaw'], 1);
console.log('errors', JSON.stringify(g.errors.slice(0, 5)));
await g.close();
