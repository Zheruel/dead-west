// blue_norther: chillChance 0.2; 3 chills freeze (stun, x1.4 damage); a foe killed while frozen shatters into 5 ice shards; bosses never freeze.
import { install } from './_i1.mjs';
export default {
  id: 'blue_norther',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('blue_norther'); o.chance = p.stats.chillChance;
      I.prep(); p.crng.chance = () => true; // every roll succeeds (stats.chillChance is capped at 0.6 and a poked stat is lost on any recompute)
      const e = I.dummy(300, 0);
      I.shoot(1, 0); I.sim(1); o.c1 = e.status.chill && e.status.chill.stacks;
      I.shoot(1, 0); I.sim(1); o.c2 = e.status.chill && e.status.chill.stacks;
      I.shoot(1, 0); I.sim(1); o.frozen = !!e.status.frozen; o.stun = !!e.status.stun; o.chillCleared = !e.status.chill;
      const h0 = e.hp; e.takeHit(10, {}); o.frozenDmg = h0 - e.hp;
      delete p.crng.chance;
      // shatter: kill a frozen foe with a bullet
      I.prep(); const k = I.dummy(300, 0, { hp: 4 });
      for (let i = 0; i < 3; i++) k.applyStatus('chill', { t: 3 });
      let shards = 0; const f = (ev) => { if (ev.bullet.child) shards++; }; bus.on('bullet:fired', f);
      I.shoot(1, 0); I.sim(1); bus.off('bullet:fired', f);
      o.dead = !k.alive; o.shards = shards;
      // boss: slowed only
      I.prep(); const b = I.dummy(300, 0); b.isBoss = true; for (let i = 0; i < 3; i++) b.applyStatus('chill', { t: 3 });
      o.boss = [!!b.status.frozen, b.status.chill && b.status.chill.mult]; b.isBoss = false;
      return o;
    });
    ok('chillChance 0.2', r.chance === 0.2);
    ok('chill stacks 1, 2, then the third freezes', r.c1 === 1 && r.c2 === 2 && r.frozen && r.stun && r.chillCleared, JSON.stringify([r.c1, r.c2, r.frozen, r.stun]));
    ok('a frozen foe takes x1.4', Math.abs(r.frozenDmg - 14) < 0.01, `${r.frozenDmg}`);
    ok('killing a frozen foe fires 5 ice shards', r.dead && r.shards === 5, `dead ${r.dead} shards ${r.shards}`);
    ok('bosses are only slowed (x0.85), never frozen', r.boss[0] === false && Math.abs(r.boss[1] - 0.85) < 1e-9, JSON.stringify(r.boss));
  },
};
