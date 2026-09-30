// lazarus_pact: pay 1 container -> rise twice (2 hp each, a container lost per rise), item removed after the 2nd, the 3rd death is final.
import { install } from './_i3.mjs';
export default {
  id: 'lazarus_pact',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, sc = window.__dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      I.prep(); p.extraHearts = 3; p.recomputeStats(); p.hp = p.maxHp;
      const mh0 = p.stats.maxHearts;
      const d = await I.deal('lazarus_pact'); o.can = d.can; o.afterPay = p.stats.maxHearts; o.charges = p.itemState.lazarus_pact && p.itemState.lazarus_pact.charges;
      const realDied = sc.onPlayerDied; sc.onPlayerDied = () => {}; // the third death is real: keep the scene alive for the next plugin
      const src = []; const f = (e) => src.push(e.source); bus.on('player:revived', f);
      const die = () => { p.hp = 0; p.tin = 0; p.godMode = false; p.hurtT = 0; p.entryInv = 0; p.dead = false; p.damage(1, { x: p.x, y: p.y }); sc.bullets.enemy.clear(); };
      const snap = () => ({ dead: p.dead, hp: p.hp, mh: p.stats.maxHearts, has: p.hasItem('lazarus_pact') });
      die(); o.r1 = snap();
      die(); o.r2 = snap();
      die(); o.r3 = snap();
      bus.off('player:revived', f); o.src = src; o.mh0 = mh0;
      sc.onPlayerDied = realDied; p.dead = false; p.hp = p.maxHp; p.recomputeStats();
      return o;
    });
    ok('paid 1 container (max hearts -1), 2 charges', r.can === true && r.afterPay === r.mh0 - 1 && r.charges === 2, `${r.mh0} -> ${r.afterPay}, charges ${r.charges}`);
    ok('first death: revived at 2 hp, one more container lost, item kept', !r.r1.dead && r.r1.hp === 2 && r.r1.mh === r.mh0 - 2 && r.r1.has, JSON.stringify(r.r1));
    ok('second death: revived at 2 hp, another container lost, item removed', !r.r2.dead && r.r2.hp === 2 && r.r2.mh === r.mh0 - 3 && !r.r2.has, JSON.stringify(r.r2));
    ok('third death is final', r.r3.dead === true, JSON.stringify(r.r3));
    ok('two player:revived events from lazarus_pact', JSON.stringify(r.src) === '["lazarus_pact","lazarus_pact"]', JSON.stringify(r.src));
  },
};
