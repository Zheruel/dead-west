// FE-I3: revive order (ARCH D7): black_cat_bone (2 hp) -> ace_in_hole pact (6 hp) -> lazarus_pact (2 hp, a container lost, x2); one revive per lethal hit.
export default {
  id: '_revive_i3',
  async run({ ev, ok }) {
    const r = await ev(async () => {
      const dw = window.__dw, p = dw.player, sc = dw.scene, I = window.__i3, o = {};
      const { bus } = await import('/src/core/events.js');
      I.prep(); p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 0 }); p.heartDebt = 0; p.extraHearts = 4; p.recomputeStats(); p.hp = p.maxHp;
      I.give('lazarus_pact'); I.give('black_cat_bone'); p.grantRevive('ace_in_hole');
      const mh0 = p.stats.maxHearts;
      const realDied = sc.onPlayerDied; sc.onPlayerDied = () => {};
      const src = [], hp = [], mh = [], deadAfter = [], has = [];
      const f = (e) => src.push(e.source); bus.on('player:revived', f);
      for (let i = 0; i < 5; i++) {
        const n = src.length;
        p.hp = 0; p.tin = 0; p.godMode = false; p.hurtT = 0; p.entryInv = 0; p.dead = false;
        p.damage(1, { x: p.x, y: p.y });
        sc.bullets.enemy.clear();
        hp.push(p.hp); mh.push(p.stats.maxHearts); deadAfter.push(p.dead); has.push([p.hasItem('black_cat_bone'), p.reviveCharges, p.hasItem('lazarus_pact')]);
        if (src.length - n > 1) o.double = true; // one revive per lethal hit
        if (p.dead) break;
      }
      bus.off('player:revived', f);
      sc.onPlayerDied = realDied; p.dead = false; p.hp = p.maxHp; p.recomputeStats();
      return { ...o, src, hp, mh, mh0, deadAfter, has };
    });
    ok('revive order black_cat_bone, ace_in_hole, lazarus_pact, lazarus_pact, then death', JSON.stringify(r.src) === '["black_cat_bone","ace_in_hole","lazarus_pact","lazarus_pact"]' && r.deadAfter[4] === true, JSON.stringify(r.src));
    ok('revive hp: 2, 6, 2, 2 units', JSON.stringify(r.hp.slice(0, 4)) === '[2,6,2,2]', JSON.stringify(r.hp));
    ok('only the lazarus revives cost a heart container (max hearts: same, same, -1, -1)', JSON.stringify(r.mh.slice(0, 4)) === JSON.stringify([r.mh0, r.mh0, r.mh0 - 1, r.mh0 - 2]), `${JSON.stringify(r.mh)} from ${r.mh0}`);
    ok('the cat bone is consumed first, the pact charge second, lazarus removed after its 2nd rise', JSON.stringify(r.has) === JSON.stringify([[false, 1, true], [false, 0, true], [false, 0, true], [false, 0, false], [false, 0, false]].slice(0, r.has.length)), JSON.stringify(r.has));
    ok('never two revives on one lethal hit', !r.double);
  },
};
