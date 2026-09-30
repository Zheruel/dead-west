// bronco_boots: rollShock 170, rollCooldown 1.25; the roll ends in a stomp: damage 10.5, stun 0.6, enemy bullets within 120 px wiped.
import { install } from './_i1.mjs';
export default {
  id: 'bronco_boots',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const base = p.stats.rollCooldown;
      I.give('bronco_boots'); const s = p.stats; o.s = [s.rollShock, s.rollShockMult, s.rollStun, s.rollCooldown - base];
      I.prep(); const e = I.dummy(240, -70), far = I.dummy(240, -300); // p ends the roll ~240 px to the right
      const eb = (dx, dy) => sc.bullets.enemy.fire({ x: p.x + dx, y: p.y + dy, angle: 0, speed: 1, damage: 1, kind: 'enemy', life: 6 });
      eb(240, 60); eb(240, 200); // one 60 px from the landing spot, one 200 px away
      const live = () => sc.bullets.enemy.list.filter((b) => b.active).length; o.b0 = live();
      p.startRoll({ x: 1, y: 0 }, { x: 1, y: 0 });
      I.sim(1, () => !p.rolling && p.rollCd > 0); I.sim(0.05);
      o.dmg = I.lost(e); o.stun = e.status.stun ? e.status.stun.t : 0; o.far = I.lost(far); o.b1 = live();
      o.px = p.x;
      // Rolling Thunder (with Silver Spurs): rollShock 230, stun 1.0, cooldown 0.9
      p.restore({ items: ['bronco_boots', 'spurs'], hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      o.thunder = [p.synergies.has('rolling_thunder'), p.stats.rollShock, Math.round(p.stats.rollStun * 100) / 100, Math.round(p.stats.rollCooldown * 100) / 100];
      return o;
    });
    ok('rollShock 170, x3, stun 0.6, cooldown +0.25', r.s[0] === 170 && r.s[1] === 3 && r.s[2] === 0.6 && Math.abs(r.s[3] - 0.25) < 1e-9, JSON.stringify(r.s));
    ok('the stomp hits a foe in range for 10.5', Math.abs(r.dmg - 10.5) < 0.05, `${r.dmg}`);
    ok('and stuns it 0.6 s', r.stun > 0.4 && r.stun <= 0.6, `${r.stun}`);
    ok('a foe out of range is untouched', r.far === 0);
    ok('enemy bullets within 120 px vanish, the far one stays', r.b0 === 2 && r.b1 === 1, `${r.b0} -> ${r.b1}`);
    ok('with Silver Spurs: Rolling Thunder (230 px, 1.0 s stun, 0.9 s cooldown)', r.thunder[0] && r.thunder[1] === 230 && r.thunder[2] === 1 && r.thunder[3] === 0.9, JSON.stringify(r.thunder));
  },
};
