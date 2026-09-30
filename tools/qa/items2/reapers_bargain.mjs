// reapers_bargain: pay 4 tin -> every shot ghostly + 2 pierce + 0.15 homing, x0.75 damage, Hunted (cursed-elite chance x2.5).
import { install } from './_i3.mjs';
export default {
  id: 'reapers_bargain',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, sc = window.__dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      const Aff = await import('/src/enemies/Affixes.js');
      I.prep(); p.addTin(4); o.tin0 = p.tin;
      const b = { pierce: p.stats.pierce, homing: p.stats.homing, bdm: p.stats.bulletDamageMult, hunted: p.stats.curseHunted, ch: Aff.chance({ floor: 1, player: p }) };
      const d = await I.deal('reapers_bargain'); o.can = d.can; o.tin = p.tin;
      o.s = { pierce: p.stats.pierce - b.pierce, homing: +(p.stats.homing - b.homing).toFixed(3), bdm: p.stats.bulletDamageMult / b.bdm, ghost: p.stats.ghostChance, hunted: p.stats.curseHunted };
      const bl = []; const f = (e) => bl.push(e.bullet); bus.on('bullet:fired', f);
      for (let i = 0; i < 12; i++) I.shoot(0, -1);
      bus.off('bullet:fired', f);
      o.allGhost = bl.length === 12 && bl.every((x) => x.spectral && x.m.ghost); o.pierce = bl[0].pierce;
      o.ratio = Aff.chance({ floor: 1, player: p }) / b.ch;
      // 3000 seeded spawn rolls: hunted vs not
      const { RNG } = await import('/src/core/rng.js');
      const { ENEMY_META } = await import('/src/enemies/registry.js');
      const count = (hunted) => { const r = new RNG(77); let n = 0; for (let i = 0; i < 3000; i++) if (Aff.roll(r, { floor: 1, enemyId: 'outlaw', def: ENEMY_META.outlaw, player: p, curseHunted: hunted, counts: { elites: 0, total: 5 } }).length) n++; return n / 3000; };
      o.rateHunted = count(1); o.ratePlain = count(0);
      // hunted chip: HUD reads stats.curseHunted
      return o;
    });
    ok('paid 4 tin', r.can === true && r.tin0 === 4 && r.tin === 0, `${r.tin0} -> ${r.tin}`);
    ok('ghostChance 1, pierce +2, homing +0.15, damage x0.75, Hunted 1', r.s.ghost === 1 && r.s.pierce === 2 && r.s.homing === 0.15 && Math.abs(r.s.bdm - 0.75) < 1e-9 && r.s.hunted === 1, JSON.stringify(r.s));
    ok('12 of 12 shots are spectral ghost bullets, pierce >= 3', r.allGhost && r.pierce >= 3, `${r.allGhost} ${r.pierce}`);
    ok('elite chance x2.5 (formula)', Math.abs(r.ratio - 2.5) < 1e-6, `${r.ratio}`);
    ok('elite rate ~20% over 3000 spawns (plain ~8%)', r.rateHunted > 0.16 && r.rateHunted < 0.25 && r.ratePlain > 0.05 && r.ratePlain < 0.11, `${r.rateHunted} vs ${r.ratePlain}`);
  },
};
