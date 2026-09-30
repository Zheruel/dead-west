// lasso_rope: the 3 nearest non-boss foes within 600 px are yanked to 90 px and stunned 1.5 s; bosses are only slowed x0.5, never moved.
import { install } from './_i3.mjs';
export default {
  id: 'lasso_rope',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(() => {
      const I = window.__i3, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      I.give('lasso_rope'); I.prep(); o.max = p.active.max;
      o.none = I.use(); o.noneCharge = p.active.charge; // empty room: refuses, charge kept
      const a = I.dummy(400, 0), b = I.dummy(320, 80), c = I.dummy(450, -150), d = I.dummy(560, 0), out = I.dummy(0, 0);
      out.x = p.x + 700; out.y = p.y; // beyond 600 px
      const dist = (e) => Math.hypot(e.x - p.x, e.y - p.y);
      const d0 = [a, b, c, d, out].map(dist); const dx0 = d.x, dy0 = d.y;
      o.ret = I.use(); o.charge = p.active.charge;
      I.sim(0.6);
      o.pulled = [a, b, c].map((e) => Math.round(dist(e)));
      o.stun = [a, b, c].map((e) => e.status.stun ? +e.status.stun.t.toFixed(2) : 0);
      o.fourth = [Math.abs(d.x - dx0) < 1 && Math.abs(d.y - dy0) < 1, !d.status.stun];
      o.out = !out.status.stun;
      o.d0 = d0.map(Math.round);
      // stunned foes stay put for ~1.5 s then wake
      I.sim(1.6); o.stunGone = !a.status.stun;
      // a boss is slowed, not moved
      I.prep(); const bs = I.dummy(300, 0); bs.isBoss = true; const bx = bs.x;
      o.bret = I.use(); I.sim(0.4);
      o.bossMoved = Math.abs(bs.x - bx) > 1; o.bossSlow = bs.status.slow ? bs.status.slow.mult : null; o.bossStun = !!bs.status.stun;
      bs.isBoss = false;
      return o;
    });
    ok('active, 3 charges', r.max === 3);
    ok('no target: returns false, charge kept', r.none === false && r.noneCharge === 3);
    ok('the 3 nearest foes end within ~90 px of the player', r.ret === true && r.pulled.every((d) => d <= 115), `${JSON.stringify(r.d0)} -> ${JSON.stringify(r.pulled)}`);
    ok('pulled foes are stunned for 1.5 s', r.stun.every((t) => t > 0.7 && t <= 1.5), JSON.stringify(r.stun));
    ok('the 4th foe (nearer than 600 px) and the one beyond 600 px are untouched', r.fourth[0] && r.fourth[1] && r.out);
    ok('the stun wears off', r.stunGone);
    ok('a boss is slowed x0.5, not moved or stunned', r.bret === true && !r.bossMoved && r.bossSlow === 0.5 && !r.bossStun, `${r.bossMoved} ${r.bossSlow} ${r.bossStun}`);
  },
};
