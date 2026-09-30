// pact_of_ashes: pay 3 dynamite -> every shot burns at 7.5 dps, burning foes spread fire 120 px, burning kills leave an 80 px pool that burns YOU.
import { install } from './_i3.mjs';
export default {
  id: 'pact_of_ashes',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, sc = window.__dw.scene, o = {};
      I.prep(); p.dynamite = 5;
      const d = await I.deal('pact_of_ashes'); o.can = d.can; o.dyn = p.dynamite;
      o.s = { burn: p.stats.burn, mult: p.stats.burnDpsMult, spread: p.stats.burnSpread, pool: p.stats.burnPoolR, hurts: p.stats.burnPoolHurts };
      // a shot burns at 7.5 dps
      I.prep(); const e = I.dummy(150, 0); I.shoot(1, 0); I.sim(0.5, () => e.status.burn);
      o.dps = e.status.burn && e.status.burn.dps;
      // burn spreads to a neighbour within 120 px on death
      I.prep(); const a = I.dummy(200, 0, { hp: 50 }), n = I.dummy(200, 100, { hp: 50000 }), far = I.dummy(200, 300, { hp: 50000 });
      a.applyStatus('burn', { dps: 7.5, t: 3 }); a.hp = 0; a.die({});
      o.spread = !!n.status.burn; o.far = !!far.status.burn;
      // the pool on the corpse burns the player: stand in it
      I.prep(); p.godMode = false; p.hp = 10; p.hurtT = 0;
      const b = I.dummy(0, 0, { hp: 50 }); b.x = p.x + 30; b.y = p.y; b.applyStatus('burn', { dps: 7.5, t: 3 }); b.hp = 0; b.die({});
      const patches = sc.room.fires ? sc.room.fires.length : null;
      I.sim(2.2, () => p.hp < 10);
      o.hpLoss = 10 - p.hp;
      // pyroImmune (Pyromaniac) protects
      I.prep(); p.godMode = false; p.hp = 10; p.hurtT = 0; p.stats.pyroImmune = 1;
      const c = I.dummy(0, 0, { hp: 50 }); c.x = p.x + 30; c.y = p.y; c.applyStatus('burn', { dps: 7.5, t: 3 }); c.hp = 0; c.die({});
      I.sim(2.2); o.pyro = 10 - p.hp;
      return o;
    });
    ok('paid 3 dynamite', r.can === true && r.dyn === 2, `${r.dyn}`);
    ok('burn 1, burnDpsMult 2.5, spread 120, pool r 80, pool hurts you', r.s.burn === 1 && r.s.mult === 2.5 && r.s.spread === 120 && r.s.pool === 80 && r.s.hurts === 1, JSON.stringify(r.s));
    ok('a shot burns for 7.5 dps', r.dps === 7.5, `${r.dps}`);
    ok('burning death ignites the neighbour within 120 px, not the one at 300 px', r.spread && !r.far, `${r.spread} ${r.far}`);
    ok('standing in the ash pool costs a unit', r.hpLoss >= 1, `${r.hpLoss}`);
    ok('pyroImmune is immune to it', r.pyro === 0, `${r.pyro}`);
  },
};
