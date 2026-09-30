// leech_contract: pay 12 coins -> kills heal 1 unit at 7% (Sixth kills +20%), red hearts pay out as coins (full = 2, half = 1).
import { install } from './_i3.mjs';
export default {
  id: 'leech_contract',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, sc = window.__dw.scene, o = {};
      const { onEnemyKilled } = await import('/src/items/fx/Kill.js');
      I.prep(); p.coins = 20;
      const d = await I.deal('leech_contract'); o.can = d.can; o.coins = p.coins;
      o.s = { kh: p.stats.killHeal, skh: p.stats.sixthKillHeal, h2c: p.stats.heartToCoin };
      // hearts become coins
      I.prep(); p.hp = 3; p.coins = 10;
      const ok1 = p.collect('heart_full'); o.full = [ok1, p.coins, p.hp]; const ok2 = p.collect('heart_half'); o.half = [ok2, p.coins, p.hp];
      p.hp = p.maxHp; p.coins = 10; p.collect('heart_full'); o.atFull = p.coins;
      p.coins = 99; o.capped = p.collect('heart_full');
      // 1000 kills at 6 hp cap: heals counted (the 0.25 s rate limit is respected by advancing the player clock)
      I.prep(); const fake = { scene: sc, x: 600, y: 500 };
      let heals = 0; const n = 1000;
      for (let i = 0; i < n; i++) { p.hp = 2; p.time += 0.3; onEnemyKilled(fake, {}, {}); if (p.hp > 2) heals++; }
      o.heals = heals;
      let sixthHeals = 0;
      for (let i = 0; i < n; i++) { p.hp = 2; p.time += 0.3; onEnemyKilled(fake, { sixth: true }, {}); if (p.hp > 2) sixthHeals++; }
      o.sixthHeals = sixthHeals;
      // full health: never heals or wastes
      p.hp = p.maxHp; p.time += 0.3; onEnemyKilled(fake, {}, {}); o.fullHp = p.hp === p.maxHp;
      // rate limit: two kills inside 0.25 s heal once at most
      p.hp = 2; p.stats.killHeal = 1 - 1e-9; p.stats.killHeal = 0.99999; p.time += 1; onEnemyKilled(fake, {}, {}); const h1 = p.hp; onEnemyKilled(fake, {}, {}); o.rate = [h1, p.hp];
      p.removeItem('leech_contract'); p.coins = 5; const d2 = await I.deal('leech_contract'); o.denied = d2.can; o.coins2 = p.coins;
      return o;
    });
    ok('paid 12 coins', r.can === true && r.coins === 8, `${r.coins}`);
    ok('killHeal 0.07, sixthKillHeal 0.2, heartToCoin 1', Math.abs(r.s.kh - 0.07) < 1e-9 && Math.abs(r.s.skh - 0.2) < 1e-9 && r.s.h2c === 1, JSON.stringify(r.s));
    ok('full heart = 2 coins, half heart = 1 coin, no healing', r.full[0] && r.full[1] === 12 && r.full[2] === 3 && r.half[0] && r.half[1] === 13, JSON.stringify([r.full, r.half]));
    ok('hearts still pay out at full health, refused when the purse is full', r.atFull === 12 && r.capped === false, `${r.atFull} ${r.capped}`);
    ok('1000 kills -> ~70 heals', r.heals > 45 && r.heals < 100, `${r.heals}`);
    ok('1000 Sixth kills heal far more often (~25%)', r.sixthHeals > 190 && r.sixthHeals < 330, `${r.sixthHeals}`);
    ok('no heal at full health; 0.25 s rate limit', r.fullHp && r.rate[1] === r.rate[0], JSON.stringify(r.rate));
    ok('11 coins: denied', r.denied === 'NEED COINS' && r.coins2 === 5);
  },
};
