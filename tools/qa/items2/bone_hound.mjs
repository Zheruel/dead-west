// bone_hound: +1 familiar; the hound kills a foe alone within 10 s and fetches a coin without the player moving; extra copy = 2nd hound (max 2).
import { install } from './_i2.mjs';

export default {
  id: 'bone_hound',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const n0 = p.familiars.length; I.give('bone_hound'); o.added = p.familiars.length - n0; o.hounds = I2.fam('BoneHound').length;
      I.sim(1);
      // 1. kill alone
      I.prep(); const e = I.dummy(260, 0, { hp: 20 });
      o.killed = I.sim(10, () => !e.alive); o.dmgSeen = e.maxHp - Math.max(0, e.hp);
      // 2. fetch: a coin 260 px from the player, nothing else in the room
      I.prep(); p.coins = 0; I.sim(0.3);
      sc.room.dropPickup('coin', 760, 560); I.sim(0.6);
      o.fetched = I.sim(6, () => p.coins > 0); o.px = p.x; o.coins = p.coins;
      // 3. copies
      I.give('bone_hound'); o.two = I2.fam('BoneHound').length; I.give('bone_hound'); o.three = I2.fam('BoneHound').length;
      // 4. checkpoint restore keeps the hounds
      const snap = p.snapshot(); p.restore(snap); o.restored = I2.fam('BoneHound').length;
      p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 }); o.cleaned = p.familiars.length;
      return o;
    });
    ok('+1 familiar (a BoneHound)', r.added === 1 && r.hounds === 1, `${r.added} ${r.hounds}`);
    ok('the hound kills a foe alone within 10 s', r.killed, `dmg ${r.dmgSeen}`);
    ok('it fetches a coin and the player collects it without moving', r.fetched && r.coins === 1 && Math.abs(r.px - 500) < 2, `${r.fetched} ${r.coins} ${r.px}`);
    ok('2nd copy adds a hound, a 3rd is capped at 2', r.two === 2 && r.three === 2, `${r.two} ${r.three}`);
    ok('hounds come back after a checkpoint restore', r.restored === 2, `${r.restored}`);
    ok('restore(empty) removes them', r.cleaned === 0, `${r.cleaned}`);
  },
};
