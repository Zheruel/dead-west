import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=11', name: 'qa1', quiet: true });
await g.tap('Enter', 80); await g.page.waitForFunction(() => window.__game.scene.isActive('Game'), { timeout: 60000 }); await g.wait(2000);
const r = await g.eval(async () => {
  const dw = window.__dw; const out = [];
  for (const kind of ['treasure', 'secret', 'shop']) {
    const rm = dw.floor.rooms.find((x) => x.type === kind); if (!rm) { out.push([kind, 'none']); continue; }
    dw.api.teleport(rm.id); await new Promise((r) => setTimeout(r, 2500));
    const R = dw.room;
    out.push([kind, R.state.pedestals.map((p) => JSON.stringify(p)), R.pedestals.map((p) => ({ rec: JSON.stringify(p.rec), item: p.itemId || (p.item && p.item.id) || null, keys: Object.keys(p).slice(0, 14) }))]);
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await g.close(); process.exit(0);
