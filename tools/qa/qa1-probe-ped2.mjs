import { boot } from './items-lib.mjs';
const g = await boot('qa1-ped', process.argv[2] || '?debug=1&seed=42');
await g.eval(() => { const a = window.__dw.api; a.godMode(true); a.give(50); });
const r = await g.eval(async () => {
  const dw = window.__dw; const out = [];
  for (const kind of ['treasure', 'secret']) {
    const rm = dw.floor.rooms.find((x) => x.type === kind); if (!rm) continue;
    dw.api.teleport(rm.id);
    for (let t = 0; t < 6; t++) {
      await new Promise((r) => setTimeout(r, 400));
      const R = dw.room, p = dw.player;
      out.push([kind, t, Math.round(p.x), Math.round(p.y), R.state.pedestals.map((q) => [q.x, q.y, q.itemId, q.taken]), p.items.length]);
    }
  }
  return out;
});
for (const l of r) console.log(JSON.stringify(l));
await g.close(); process.exit(0);
