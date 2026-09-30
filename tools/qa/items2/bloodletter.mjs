// bloodletter: pay 15 coins -> Sixth Bullet x4; every Sixth shot costs 1 hp unit, but only while hp > 2 (at 2 or less: no cost, no x4).
import { install } from './_i3.mjs';
export default {
  id: 'bloodletter',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, o = {};
      const { bus } = await import('/src/core/events.js');
      I.prep(); p.coins = 20; p.godMode = false;
      const base = p.stats.damage, sm = p.stats.sixthMult;
      const d = await I.deal('bloodletter'); o.can = d.can; o.coins = p.coins;
      const dm = []; const g = (e) => dm.push(e.bullet.dmg * e.bullet.mult); bus.on('bullet:fired', g);
      const sixthShot = (hp) => { p.hp = hp; p.recomputeStats(); p.grantSixth(1); dm.length = 0; I.shoot(0, -1); return { hp: p.hp, dmg: dm[0], cost: p.stats.sixthCost, mult: p.stats.sixthMult }; };
      o.at6 = sixthShot(6); o.at3 = sixthShot(3); o.at2 = sixthShot(2); o.at1 = sixthShot(1);
      // a normal shot never costs hp
      p.hp = 6; p.recomputeStats(); dm.length = 0; I.shoot(0, -1); o.normalHp = p.hp;
      bus.off('bullet:fired', g);
      o.base = base; o.sm = sm;
      // pay flow: 15 coins (shop discounts do not apply to deal.pay in ItemSystem)
      p.removeItem('bloodletter'); p.coins = 14; const d2 = await I.deal('bloodletter'); o.denied = d2.can; o.coins2 = p.coins;
      return o;
    });
    ok('paid 15 coins', r.can === true && r.coins === 5, `${r.coins}`);
    ok('Sixth at 6 hp: hits x4 (14) and costs 1 unit (6 -> 5)', r.at6.hp === 5 && Math.abs(r.at6.dmg - r.base * 4) < 0.01, JSON.stringify(r.at6));
    ok('Sixth at 3 hp: still x4 and costs 1 (3 -> 2)', r.at3.hp === 2 && Math.abs(r.at3.dmg - r.base * 4) < 0.01, JSON.stringify(r.at3));
    ok('Sixth at 2 hp: no cost and no x4 (plain x2)', r.at2.hp === 2 && Math.abs(r.at2.dmg - r.base * r.sm) < 0.01 && r.at2.cost === 0, JSON.stringify(r.at2));
    ok('Sixth at 1 hp: no cost, plain x2', r.at1.hp === 1 && Math.abs(r.at1.dmg - r.base * r.sm) < 0.01, JSON.stringify(r.at1));
    ok('normal shots never cost hp', r.normalHp === 6);
    ok('unaffordable (14 coins): denied, nothing paid', r.denied === 'NEED COINS' && r.coins2 === 14);
  },
};
