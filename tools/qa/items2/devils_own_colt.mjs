// devils_own_colt: pay 1 heart container -> x1.5 bullet damage, fireDelay x1.15. Refused at one container, no state change when unaffordable.
import { install } from './_i3.mjs';
export default {
  id: 'devils_own_colt',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, o = {};
      I.prep();
      const mh = p.stats.maxHearts, bdm = p.stats.bulletDamageMult, fd = p.stats.fireDelay, dmg = p.stats.damage;
      const d = await I.deal('devils_own_colt'); o.can = d.can; o.paid = d.paid; o.pool = (await import('/src/items/registry.js')).getItem('devils_own_colt').pool.join(',');
      o.mh = [mh, p.stats.maxHearts]; o.debt = p.heartDebt;
      o.bdm = p.stats.bulletDamageMult / bdm; o.fd = p.stats.fireDelay / fd;
      // real bullet damage
      const { bus } = await import('/src/core/events.js'); const dm = []; const f = (e) => dm.push(e.bullet.dmg * e.bullet.mult); bus.on('bullet:fired', f); I.shoot(0, -1); bus.off('bullet:fired', f); o.shot = dm[0]; o.base = dmg;
      // refused at one container
      p.removeItem('devils_own_colt'); p.heartDebt = 0; p.extraHearts = 0; p.recomputeStats();
      p.heartDebt = p.stats.maxHearts - 1; p.recomputeStats(); o.one = p.stats.maxHearts;
      const before = JSON.stringify([p.heartDebt, p.stats.maxHearts, p.items]);
      const d2 = await I.deal('devils_own_colt'); o.refused = d2.can; o.same = before === JSON.stringify([p.heartDebt, p.stats.maxHearts, p.items]);
      return o;
    });
    ok('crossroads pool only, deal.pay 1 container', r.pool === 'crossroads' && r.paid && r.paid.container === 1);
    ok('paying costs one heart container', r.can === true && r.mh[1] === r.mh[0] - 1 && r.debt === 1, JSON.stringify(r.mh));
    ok('bulletDamageMult x1.5, fireDelay x1.15', Math.abs(r.bdm - 1.5) < 1e-9 && Math.abs(r.fd - 1.15) < 1e-9, `${r.bdm} ${r.fd}`);
    ok('a real bullet does 1.5 x damage', Math.abs(r.shot - r.base * 1.5) < 0.01, `${r.shot} vs ${r.base}`);
    ok('refused at one container (NEED MORE HEARTS), nothing changes', r.one === 1 && r.refused === 'NEED MORE HEARTS' && r.same, `${r.one} ${r.refused}`);
  },
};
