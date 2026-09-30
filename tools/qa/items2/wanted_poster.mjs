// wanted_poster: on each wave the highest-maxHp non-boss foe is marked (8 s): x1.5 damage; a marked kill pays 1 nickel + 15% half heart.
import { install } from './_i1.mjs';
export default {
  id: 'wanted_poster',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('wanted_poster'); o.n1 = p.stats.markCount;
      const wave = (list) => { bus.emit('room:wave', { room: sc.room, enemies: list }); I.sim(0.05); };
      // 1. the toughest foe of the wave is marked; a boss and a weaker foe are not
      I.prep();
      const a = I.dummy(200, 0, { hp: 50 }), b = I.dummy(250, 80, { hp: 90 }), c = I.dummy(250, -80, { hp: 60 }), boss = I.dummy(300, 0, { hp: 500 }); boss.isBoss = true;
      sc.room.waveEnemies = [a, b, c, boss];
      wave([a, b, c, boss]);
      o.marked = [!!a.status.mark, !!b.status.mark, !!c.status.mark, !!boss.status.mark];
      o.t = b.status.mark ? b.status.mark.t : 0;
      const st = p.itemState.wanted_poster; const im = st && st.imgs[0]; o.img = !!(im && im.scene && im.visible);
      // 2. +50% damage
      const h = b.hp; b.takeHit(10, {}); o.dmg = h - b.hp; const h2 = a.hp; a.takeHit(10, {}); o.plain = h2 - a.hp;
      // 3. expiry
      I.sim(8.3); o.expired = !b.status.mark;
      // 4. bounty: a marked kill drops a nickel (always) and a half heart (15%)
      I.prep(); let nick = 0, hearts = 0; const N = 200;
      for (let i = 0; i < N; i++) {
        const e = I.dummy(200, 0, { hp: 5 }); e.noLoot = true; e.applyStatus('mark', { t: 8 }); e.takeHit(50, {}); I.ff(1);
        if (i % 20 === 19) { nick += I.pickups('coin_nickel'); hearts += I.pickups('heart_half'); I.prep(); }
      }
      o.nick = nick; o.hearts = hearts;
      // an unmarked kill pays nothing extra
      I.prep(); const u = I.dummy(200, 0, { hp: 5 }); u.noLoot = true; u.takeHit(50, {}); I.ff(2); o.plainKill = I.pickups('coin_nickel') + I.pickups('heart_half');
      // 5. second copy: two foes per wave
      I.give('wanted_poster'); o.n2 = p.stats.markCount;
      I.prep(); const d = [40, 80, 70, 20].map((hp, i) => I.dummy(200 + i * 20, i * 60 - 90, { hp })); sc.room.waveEnemies = d; wave(d);
      o.two = d.map((e) => !!e.status.mark);
      return o;
    });
    ok('markCount 1, 2 with a second copy', r.n1 === 1 && r.n2 === 2, `${r.n1} ${r.n2}`);
    ok('only the toughest non-boss foe is marked (8 s)', JSON.stringify(r.marked) === '[false,true,false,false]' && r.t > 7.5 && r.t <= 8, JSON.stringify([r.marked, r.t]));
    ok('a mark crosshair is drawn over it', r.img);
    ok('marked foes take x1.5 (15), others x1 (10)', Math.abs(r.dmg - 15) < 0.01 && Math.abs(r.plain - 10) < 0.01, `${r.dmg} ${r.plain}`);
    ok('the mark expires after 8 s', r.expired);
    ok('every marked kill drops a nickel', r.nick === 200, `${r.nick}`);
    ok('about 15% also drop a half heart', r.hearts >= 14 && r.hearts <= 48, `${r.hearts} of 200`);
    ok('an unmarked kill pays no bounty', r.plainKill === 0, `${r.plainKill}`);
    ok('the second copy marks the two toughest', JSON.stringify(r.two) === '[false,true,true,false]', JSON.stringify(r.two));
  },
};
