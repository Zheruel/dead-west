// ouija_planchette: 3 s of spirit form: untouchable (spiritT), +80 move speed, every shot ghostly (spectral, +1 pierce) with +1 pierce.
import { install } from './_i3.mjs';
export default {
  id: 'ouija_planchette',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('ouija_planchette'); I.prep(); o.max = p.active.max;
      const base = p.stats.moveSpeed, basePierce = p.stats.pierce, baseGhost = p.stats.ghostChance;
      p.godMode = false; p.hp = 10;
      o.ret = I.use();
      o.spirit = p.spiritT; o.inv = p.invulnerable; o.speed = p.stats.moveSpeed - base; o.ghost = p.stats.ghostChance; o.pierce = p.stats.pierce - basePierce;
      const hp0 = p.hp; const hit = p.damage(1, { x: p.x + 20, y: p.y }); o.hurtBlocked = hit === false && p.hp === hp0;
      const bl = []; const f = (e) => bl.push(e.bullet); bus.on('bullet:fired', f); I.shoot(0, -1); bus.off('bullet:fired', f);
      o.spectral = !!(bl[0] && bl[0].spectral); o.bPierce = bl[0] ? bl[0].pierce : -1; o.ghostMod = !!(bl[0] && bl[0].m && bl[0].m.ghost);
      o.alpha = p.sprite ? p.sprite.alpha : 1;
      I.sim(3.3);
      o.after = { spirit: p.spiritT <= 0, inv: p.invulnerable, speed: p.stats.moveSpeed - base, ghost: p.stats.ghostChance - baseGhost, pierce: p.stats.pierce - basePierce };
      p.hurtT = 0; const hp1 = p.hp; p.damage(1, { x: p.x + 20, y: p.y }); o.hurtLands = p.hp < hp1;
      return o;
    });
    ok('active, 5 charges', r.max === 5);
    ok('spirit form: untouchable for 3 s', r.ret === true && r.spirit > 2.8 && r.inv && r.hurtBlocked, `${r.spirit} ${r.inv} ${r.hurtBlocked}`);
    ok('+80 move speed, ghostChance 1, +1 pierce', r.speed === 80 && r.ghost === 1 && r.pierce === 1, `${r.speed} ${r.ghost} ${r.pierce}`);
    ok('shots are spectral ghost bullets that pierce (base 0 + 1 buff + 1 ghost)', r.spectral && r.ghostMod && r.bPierce >= 2, `${r.spectral} ${r.ghostMod} ${r.bPierce}`);
    ok('the buff ends after 3 s (stats back to normal, hurt lands)', r.after.spirit && !r.after.inv && r.after.speed === 0 && r.after.ghost === 0 && r.after.pierce === 0 && r.hurtLands, JSON.stringify(r.after));
  },
};
