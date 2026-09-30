// pawn_ticket: sells every key / dynamite beyond the first (4c / 3c) straight into coins; refuses (charge kept) with nothing to sell.
import { install } from './_i3.mjs';
export default {
  id: 'pawn_ticket',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(() => {
      const I = window.__i3, p = window.__dw.player, o = {};
      I.give('pawn_ticket'); I.prep(); o.active = p.active && p.active.id; o.max = p.active && p.active.max;
      p.keys = 5; p.dynamite = 4; p.coins = 10; p._coinFrac = 0;
      const s = p.stats.coinMult; p.stats.coinMult = 3; // coinMult must not apply
      o.ret = I.use(); p.stats.coinMult = s;
      o.keys = p.keys; o.dyn = p.dynamite; o.coins = p.coins; o.charge = p.active.charge;
      p.active.charge = p.active.max; o.ret2 = p.useActive(); o.charge2 = p.active.charge; o.keys2 = p.keys; o.dyn2 = p.dynamite;
      p.keys = 0; p.dynamite = 0; p.active.charge = p.active.max; o.ret3 = p.useActive(); o.charge3 = p.active.charge;
      p.keys = 6; p.dynamite = 1; p.coins = 98; p.active.charge = p.active.max; o.ret4 = p.useActive(); o.cap = p.coins; o.keys4 = p.keys;
      return o;
    });
    ok('active, 3 charges', r.active === 'pawn_ticket' && r.max === 3);
    ok('keys 5 + dynamite 4 -> keeps 1 each, coins +25 (4c/key, 3c/stick), coinMult ignored', r.ret === true && r.keys === 1 && r.dyn === 1 && r.coins === 35, `${r.keys} ${r.dyn} ${r.coins}`);
    ok('charge is spent on a sale', r.charge === 0);
    ok('nothing to sell: returns false, charge kept', r.ret2 === false && r.charge2 === 3 && r.keys2 === 1 && r.dyn2 === 1);
    ok('zero stock: returns false, charge kept', r.ret3 === false && r.charge3 === 3);
    ok('99 coin cap respected (stops selling once full)', r.ret4 === true && r.cap === 99 && r.keys4 === 5, `${r.cap} ${r.keys4}`);
  },
};
