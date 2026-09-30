// gold_fever: pay 25 coins -> +1.5% damage per coin held (cap +75%); a hit scatters 25% of the coins (min 3) as re-collectable pickups.
import { install } from './_i3.mjs';
export default {
  id: 'gold_fever',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, o = {};
      I.prep(); p.coins = 65; p.godMode = false; p.hp = 10;
      const bdm = p.stats.bulletDamageMult;
      const d = await I.deal('gold_fever'); o.can = d.can; o.coins = p.coins; // 40 left
      o.x40 = p.stats.bulletDamageMult / bdm;
      p.coins = 0; p.recomputeStats(); o.x0 = p.stats.bulletDamageMult / bdm;
      p.coins = 99; p.recomputeStats(); o.x99 = p.stats.bulletDamageMult / bdm; // capped at +75%
      p.coins = 40; p.recomputeStats();
      // the engine recomputes on a coin change by itself
      p.coins = 20; I.sim(0.1); o.x20 = p.stats.bulletDamageMult / bdm;
      // hit: 25% of 40 = 10 coins scatter as pickups
      p.coins = 40; p.recomputeStats(); I.prep(); p.godMode = false; p.hp = 10; p.coins = 40;
      p.damage(1, { x: p.x + 10, y: p.y });
      const val = (t) => I.pickups(t);
      o.coinsAfter = p.coins; o.single = val('coin'); o.nick = val('coin_nickel');
      // small purse: minimum 3
      I.prep(); p.godMode = false; p.hp = 10; p.coins = 5; p.damage(1, { x: p.x + 10, y: p.y }); o.small = [p.coins, val('coin')];
      // nothing to drop with 0 coins
      I.prep(); p.godMode = false; p.hp = 10; p.coins = 0; p.damage(1, { x: p.x + 10, y: p.y }); o.zero = [p.coins, I.pickups('coin')];
      // large purse: nickels
      I.prep(); p.godMode = false; p.hp = 10; p.coins = 96; p.damage(1, { x: p.x + 10, y: p.y }); o.big = [p.coins, val('coin'), val('coin_nickel')];
      // the scattered coins can be picked up again
      const before = p.coins; for (const pk of [...window.__dw.scene.room.pickups]) p.collect(pk.type); o.regained = p.coins - before;
      return o;
    });
    ok('paid 25 coins', r.can === true && r.coins === 40);
    ok('40 coins -> bulletDamageMult x1.6, 0 coins -> x1.0', Math.abs(r.x40 - 1.6) < 1e-9 && Math.abs(r.x0 - 1) < 1e-9, `${r.x40} ${r.x0}`);
    ok('capped at +75% (99 coins -> x1.75)', Math.abs(r.x99 - 1.75) < 1e-9, `${r.x99}`);
    ok('recomputes by itself when coins change', Math.abs(r.x20 - 1.3) < 1e-9, `${r.x20}`);
    ok('a hit at 40 coins drops 10 (30 left) as >= 3 pickups', r.coinsAfter === 30 && r.single + r.nick >= 3, `${r.coinsAfter} ${r.single} ${r.nick}`);
    ok('minimum loss of 3 coins', r.small[0] === 2 && r.small[1] === 3, JSON.stringify(r.small));
    ok('no coins, no drop', r.zero[0] === 0 && r.zero[1] === 0);
    ok('large purse scatters nickels: 96 -> 72, 24 coins = 4 nickels + 4 coins', r.big[0] === 72 && r.big[2] === 4 && r.big[1] === 4, JSON.stringify(r.big));
    ok('the scattered coins are collectable again', r.regained === 24, `${r.regained}`);
  },
};
