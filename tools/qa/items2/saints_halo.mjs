// saints_halo: haloCharges 1; the next hit of any source is absorbed with a 200 px nova for 3 x damage; the second lands; a new floor re-arms it.
import { install } from './_i2.mjs';

export default {
  id: 'saints_halo',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const n0 = p.familiars.length; I.give('saints_halo'); o.added = p.familiars.length - n0; o.charges = p.stats.haloCharges; o.left = p.haloLeft;
      I.prep(); o.dmg = p.stats.damage; const e = I.dummy(120, 0); const far = I.dummy(500, 200); I.sim(0.3);
      o.lost1 = I2.hurt(1); I.sim(0.2); o.nova = I.lost(e); o.novaFar = I.lost(far); o.left1 = p.haloLeft;
      I.sim(1); o.lost2 = I2.hurt(1);
      p.hp = p.maxHp; dw.api.setFloor(2); I.sim(0.5); o.rearm = p.haloLeft;
      o.copies = (() => { I.give('saints_halo'); return [p.stats.haloCharges, I2.fam('SaintsHalo').length]; })();
      p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      return o;
    });
    ok('haloCharges 1, armed, a halo familiar', r.charges === 1 && r.left === 1 && r.added === 1, `${r.charges} ${r.left} ${r.added}`);
    ok('the first hit is absorbed and the halo is spent', r.lost1 === 0 && r.left1 === 0, `${r.lost1} ${r.left1}`);
    ok('nova hits a foe in 200 px for 3 x damage, spares a far one', Math.abs(r.nova - 3 * r.dmg) <= 0.06 * 3 * r.dmg && r.novaFar === 0, `${r.nova} ${r.novaFar} (3 x ${r.dmg})`);
    ok('the second hit lands', r.lost2 > 0, `${r.lost2}`);
    ok('a new floor re-arms it', r.rearm === 1, `${r.rearm}`);
    ok('a second copy adds a charge but not a second halo', r.copies[0] === 2 && r.copies[1] === 1, JSON.stringify(r.copies));
  },
};
