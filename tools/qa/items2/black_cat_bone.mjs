// black_cat_bone: cheat death once (Player.tryRevive): hp 2, item removed, RISEN blast, `player:revived`; the second death is final.
import { install } from './_i1.mjs';
export default {
  id: 'black_cat_bone',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('black_cat_bone'); o.owned = p.items.includes('black_cat_bone');
      I.prep(); const e = I.dummy(120, 0, { hp: 30 }); e.maxHp = 30;
      let revived = null; const f = (ev) => { revived = ev.source; }; bus.on('player:revived', f);
      const dieOrig = p.die; let died = 0; p.die = () => { died++; };
      p.hp = p.maxHp; dw.api.die();
      o.hp = p.hp; o.tin = p.tin; o.gone = !p.items.includes('black_cat_bone'); o.revived = revived; o.died1 = died; o.grace = p.hurtT > 1; o.blast = 30 - e.hp;
      p.hp = p.maxHp; dw.api.die(); o.died2 = died;
      p.die = dieOrig; bus.off('player:revived', f);
      return o;
    });
    ok('owned, no stat change needed', r.owned);
    ok('a lethal hit revives at 2 hp (1 heart), item consumed', r.hp === 2 && r.gone && r.died1 === 0, JSON.stringify([r.hp, r.gone, r.died1]));
    ok('`player:revived` fires with the bone as source, grace i-frames', r.revived === 'black_cat_bone' && r.grace, `${r.revived}`);
    ok('the RISEN blast hurts nearby foes (40)', r.blast >= 29.9, `${r.blast}`);
    ok('the second lethal hit is final', r.died2 === 1, `${r.died2}`);
  },
};
