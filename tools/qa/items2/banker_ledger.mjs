// banker_ledger: on room clear min(5, floor(coins / 8)) coin PICKUPS pop; nothing under 8 coins.
import { install } from './_i2.mjs';

export default {
  id: 'banker_ledger',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('banker_ledger'); o.s = [p.stats.interestDiv, p.stats.interestCap];
      const clear = (coins) => { I.prep(); p.coins = coins; I.sim(0.1); bus.emit('room:cleared', { room: sc.room }); I.sim(0.1); return I.pickups('coin'); };
      o.c7 = clear(7); o.c8 = clear(8); o.c24 = clear(24); o.c40 = clear(40); o.c99 = clear(99);
      // the real thing: clearRoom() with 40 coins pops at least the 5 interest pickups
      I.prep(); p.coins = 40; sc.room.state.cleared = false; dw.api.clearRoom(); I.sim(0.2); o.real = I.pickups('coin');
      o.coinsKept = p.coins; // interest never touches the purse
      // Money Talks: +3 cap
      I.give('hush_money'); o.cap = p.stats.interestCap; o.talks = [...p.synergies].includes('money_talks');
      o.c99b = clear(99);
      return o;
    });
    ok('interestDiv 8, interestCap 5', r.s[0] === 8 && r.s[1] === 5, JSON.stringify(r.s));
    ok('7 coins -> 0 pickups, 8 -> 1, 24 -> 3', r.c7 === 0 && r.c8 === 1 && r.c24 === 3, `${r.c7} ${r.c8} ${r.c24}`);
    ok('40 coins -> 5 pickups, 99 coins capped at 5', r.c40 === 5 && r.c99 === 5, `${r.c40} ${r.c99}`);
    ok('clearRoom() with 40 coins pops >= 5 coin pickups', r.real >= 5, `${r.real}`);
    ok('the purse itself is untouched', r.coinsKept === 40, `${r.coinsKept}`);
    ok('Money Talks raises the cap to 8', r.talks && r.cap === 8 && r.c99b === 8, `${r.talks} ${r.cap} ${r.c99b}`);
  },
};
