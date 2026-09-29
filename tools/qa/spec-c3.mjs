import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=5');
const r = await g.eval(() => {
  const p = window.__dw.player, o = {};
  o.start = { hp: p.hp, max: p.maxHp, dyn: p.dynamite, tin: p.tin, coins: p.coins, keys: p.keys };
  o.fullHeal = p.collect('heart_full'); // false at full
  p.hp = 3; o.half = [p.collect('heart_half'), p.hp]; o.full = [p.collect('heart_full'), p.hp];
  o.tin = [p.collect('heart_tin'), p.tin];
  p.hp = 6; p.tin = 4; p.damage; // take 3 damage: tin first
  p.hurtT = 0; p.entryInv = 0; window.__dw.api.godMode(false);
  p.damage(3, {}); o.dmg3 = [p.hp, p.tin];
  p.coins = 98; p.collect('coin_nickel'); o.coin99 = p.coins; o.nickelAt99 = p.collect('coin_nickel');
  p.keys = 99; o.key99 = p.collect('key'); p.dynamite = 99; o.dyn99 = p.collect('dynamite');
  // max hearts
  p.items.push(...Array(12).fill('snake_oil')); p.recomputeStats(); o.maxHearts = p.stats.maxHearts;
  p.tin = 0; o.tinAtMax = p.collect('heart_tin');
  return o;
});
console.log(JSON.stringify(r));
console.log('errors', g.errors);
await g.close();
