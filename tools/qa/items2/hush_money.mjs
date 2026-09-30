// hush_money: a hit is paid off (8 coins, once per room, 6 s cooldown, 0.6 s grace); < 8 coins -> the hit lands. Money Talks: 5 coins and the coins drop.
import { install } from './_i2.mjs';

export default {
  id: 'hush_money',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('hush_money'); o.cost = p.stats.hushCost;
      I.prep(); p.coins = 20; I.sim(0.1);
      const hp = p.hp;
      o.lost1 = I2.hurt(1); o.coins1 = p.coins; o.grace = p.hurtT;
      I.sim(1); o.lost2 = I2.hurt(1); o.coins2 = p.coins; // same room: lands
      // new room: still on the 6 s global cooldown, then works again
      p.hp = p.maxHp; I.sim(0.7); bus.emit('room:entered', { room: sc.room }); I.sim(0.1);
      o.lost3 = I2.hurt(1); p.hp = p.maxHp; I.sim(6.2); bus.emit('room:entered', { room: sc.room }); I.sim(0.1);
      p.coins = 20; o.lost4 = I2.hurt(1); o.coins4 = p.coins;
      // not enough coins
      p.hp = p.maxHp; I.sim(6.2); bus.emit('room:entered', { room: sc.room }); I.sim(0.1); p.coins = 5; o.lost5 = I2.hurt(1); o.coins5 = p.coins;
      // Money Talks
      I.give('banker_ledger'); o.talks = [...p.synergies].includes('money_talks'); o.cost2 = p.stats.hushCost;
      I.prep(); p.coins = 20; p.hp = p.maxHp; I.sim(6.2); bus.emit('room:entered', { room: sc.room }); I.sim(0.1);
      o.lost6 = I2.hurt(1); o.coins6 = p.coins; I.sim(0.2); o.drop = I.pickups('coin');
      return o;
    });
    ok('hushCost 8', r.cost === 8, `${r.cost}`);
    ok('20 coins: hit ignored, coins 12, 0.6 s grace', r.lost1 === 0 && r.coins1 === 12 && r.grace >= 0.55, `${r.lost1} ${r.coins1} ${r.grace}`);
    ok('second hit in the same room lands', r.lost2 > 0 && r.coins2 === 12, `${r.lost2} ${r.coins2}`);
    ok('new room but inside the 6 s cooldown: lands; after it: hushed again', r.lost3 > 0 && r.lost4 === 0 && r.coins4 === 12, `${r.lost3} ${r.lost4} ${r.coins4}`);
    ok('5 coins: the hit applies and no coins are spent', r.lost5 > 0 && r.coins5 === 5, `${r.lost5} ${r.coins5}`);
    ok('Money Talks: cost 5, the paid coins drop as pickups', r.talks && r.cost2 === 5 && r.lost6 === 0 && r.coins6 === 15 && r.drop === 5, `${r.talks} ${r.cost2} ${r.lost6} ${r.coins6} ${r.drop}`);
  },
};
