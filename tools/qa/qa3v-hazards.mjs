// QA-3 v: hazard gallery per floor (uses hazard-check rig). node tools/qa/qa3v-hazards.mjs
import { boot, seq } from './qa3v-lib.mjs';
import { installRig } from './hazard-check.mjs';
const g = await boot('?debug=1&seed=13&unlockall=1');
await g.play();
await g.eval(installRig);
const rooms = {
  f4: { f: 4, tiles: [[1, 1, 'L'], [2, 1, 'L'], [3, 1, 'L'], [4, 1, 'L'], [5, 1, 'L'], [7, 1, 'V'], [9, 1, 'V'], [2, 5, 's'], [3, 5, 's'], [4, 5, 's'], [10, 3, 'S'], [11, 3, 'S'], [5, 3, 'Q'], [6, 3, 'Q'], [7, 3, 'Q'], [5, 4, 'Q'], [6, 4, 'Q'], [11, 5, 'P'], [8, 5, 'R']], fields: { lavaSpit: true } },
  f5: { f: 5, tiles: [[1, 3, '='], [2, 3, '='], [3, 3, '='], [4, 3, '='], [5, 3, '='], [6, 3, '='], [7, 3, '='], [8, 3, '='], [9, 3, '='], [10, 3, '='], [11, 3, '='], [6, 1, '|'], [6, 2, '|'], [6, 4, '|'], [6, 5, '|'], [0, 2, 'T'], [12, 4, 'T'], [3, 1, 'Z'], [9, 5, 'Z'], [2, 5, 'G'], [10, 1, 'G']], fields: { lanes: [{ axis: 'h', index: 3, period: 4, offset: 0, dir: 1, kind: 'cart' }, { axis: 'v', index: 6, period: 5, offset: 1, dir: 1, kind: 'ghost' }] } },
  f6: { f: 6, tiles: [[3, 2, 'r'], [4, 2, 'k'], [5, 2, 'r'], [6, 2, 'k'], [7, 2, 'r'], [8, 2, 'k'], [9, 2, 'r'], [3, 3, 'k'], [4, 3, 'r'], [5, 3, 'k'], [6, 3, 'r'], [7, 3, 'k'], [8, 3, 'r'], [9, 3, 'k'], [3, 4, 'r'], [4, 4, 'k'], [5, 4, 'r'], [6, 4, 'k'], [7, 4, 'r'], [8, 4, 'k'], [9, 4, 'r']], fields: { chandelier: true, roulette: true } },
};
for (const [k, o] of Object.entries(rooms)) {
  await g.api((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); }, o.f);
  await g.wait(4500);
  await g.api((o) => { window.__rig.restore(); window.__rig.room({ tiles: o.tiles, fields: o.fields, combat: false, at: [720, 860] }); window.__dw.player.godMode = true; }, o);
  await g.wait(1500);
  await seq(g, `haz_${k}`, 6, 1400, { cols: 3, w: 720 });
  console.log(k, 'errors', g.errors.slice(0, 4));
}
// enemies in lanes / lava room with bullets
await g.close();
