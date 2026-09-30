// Per-item plugin template (files starting with `_` are ignored by regress-items2). Copy to <item_id>.mjs.
// run({g, ev, ok, reset, warn}): `ev(fn, ...args)` runs in the page; `reset()` returns to an empty godMode build; the page exposes window.__dw {player, scene, api}.
export default {
  id: 'example_item',
  async run({ ev, ok }) {
    const r = await ev(async () => {
      const dw = window.__dw, p = dw.player;
      dw.scene.items.pickup(p, 'example_item', 'debug');
      return { stat: p.stats.luck };
    });
    ok('stat applied', typeof r.stat === 'number');
  },
};
