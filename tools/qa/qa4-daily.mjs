// QA-4 daily determinism: start {mode:'daily', date} twice (fresh page each), visit every room of floors 1-6 in DIFFERENT orders, compare layout + per-room content states.
import { open, sleep } from './qa4-lib.mjs';
const DATE = process.argv[2] || '2026-09-30';
async function run(order) {
  const g = await open('?debug=1&unlockall=1', { name: 'qa4-daily' });
  await g.eval((date) => { const gm = window.__game; for (const s of gm.scene.getScenes(true)) gm.scene.stop(s.sys.settings.key); gm.scene.start('Game', { mode: 'daily', date }); }, DATE);
  await g.page.waitForFunction(() => window.__dw && window.__dw.player, { timeout: 60000 }); await sleep(1500);
  const out = { seed: await g.eval(() => window.__dw.scene.seed), floors: {} };
  for (let f = 1; f <= 6; f++) {
    await g.eval((f) => { const a = window.__dw.api; a.godMode(true); if (f > 1) a.setFloor(f); }, f); await sleep(1200);
    const layout = await g.eval(() => window.__dw.floor.rooms.map((r) => ({ id: r.id, type: r.type, tpl: r.tpl || r.template || (r.def && r.def.tpl), seed: r.seed, variant: r.variant, mod: r.mod, x: r.x, y: r.y })));
    const ids = layout.map((r) => r.id); if (order === 'rev') ids.reverse();
    const rooms = {};
    for (const id of ids) {
      await g.eval((id) => { const a = window.__dw.api; a.godMode(true); a.teleport(id); }, id); await sleep(500);
      rooms[id] = await g.eval((id) => { const st = window.__dw.scene.roomMgr.stateFor(id); const r = window.__dw.scene.room; return { ped: (st.pedestals || []).map((p) => p.itemId + '@' + p.price), pk: (st.pickups || []).map((p) => p.type), ev: st.event && JSON.stringify(st.event).slice(0, 200), ctl: st.ctl && JSON.stringify(st.ctl).slice(0, 200), en: r && r.def && r.def.enemies ? JSON.stringify(r.def.enemies).slice(0, 200) : null, wave: r && r.waves ? r.waves.length : null, keys: Object.keys(st).join(',') }; }, id);
    }
    out.floors[f] = { layout, rooms };
  }
  out.errors = g.errors.filter((e) => !/favicon/.test(e)); out.rej = await g.rejections();
  await g.close(); return out;
}
const A = await run('fwd'), B = await run('rev'), C = await run('fwd');
const diffs = [];
const cmp = (n, a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) diffs.push(`${n}: ${x.slice(0, 160)} != ${y.slice(0, 160)}`); };
cmp('seed A/B', A.seed, B.seed); cmp('seed A/C', A.seed, C.seed);
for (let f = 1; f <= 6; f++) {
  cmp(`F${f} layout A/B`, A.floors[f].layout, B.floors[f].layout); cmp(`F${f} layout A/C`, A.floors[f].layout, C.floors[f].layout);
  for (const id of Object.keys(A.floors[f].rooms)) { cmp(`F${f} ${id} content fwd/fwd`, A.floors[f].rooms[id], C.floors[f].rooms[id]); cmp(`F${f} ${id} content fwd/rev`, A.floors[f].rooms[id], B.floors[f].rooms[id]); }
}
console.log('seed', A.seed, 'rooms/floor', Object.values(A.floors).map((x) => x.layout.length));
console.log('errors', A.errors, B.errors, C.errors, 'rej', A.rej.length, B.rej.length, C.rej.length);
console.log(diffs.length ? 'DIFFS ' + diffs.length + '\n' + diffs.slice(0, 40).join('\n') : 'DAILY DETERMINISTIC (3 loads, 2 visit orders)');
console.log('sample F2', JSON.stringify(A.floors[2].rooms).slice(0, 600));
