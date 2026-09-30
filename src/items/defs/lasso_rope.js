import { registerItem } from '../registry.js';
import { DEPTH } from '../../config.js';
import { Sfx } from '../../core/Audio.js';

const RANGE = 600, COUNT = 3, STOP = 90, PULL = 0.25, STUN = 1.5, BOSS_SLOW = 0.5;

// The pull in flight (module scratch, never in itemState: it holds live enemies). Advanced by the `update` hook in game time, so it follows
// hit-stop, slow-mo and pause instead of wall-clock tweens.
const pulls = [];
let ropes = null, pullT = 0, pullScene = null;

function endPull() {
  pulls.length = 0;
  if (ropes && ropes.scene) ropes.destroy();
  ropes = null; pullScene = null;
}

function stepPull(player, dt) {
  if (!pulls.length) return;
  if (pullScene !== player.scene || !ropes || !ropes.scene) { endPull(); return; }
  pullT = Math.min(PULL, pullT + dt);
  const k = 1 - Math.pow(1 - pullT / PULL, 3); // cubic ease-out
  ropes.clear();
  ropes.lineStyle(4, 0xc8a878, 1 - (pullT / PULL) * 0.6);
  for (let i = 0; i < pulls.length; i++) {
    const p = pulls[i], e = p.e;
    if (!e.alive || !e.sprite) continue;
    e.moveBy(p.sx + (p.tx - p.sx) * k - e.x, p.sy + (p.ty - p.sy) * k - e.y); // resolved against walls / rocks by Actor.moveBy
    ropes.lineBetween(player.x, player.y - 24, e.x, e.y - 24);
  }
  if (pullT >= PULL) endPull();
}

// Active (3 room clears): yank the 3 nearest foes within 600 px to 90 px from you (0.25 s pull) and stun them for 1.5 s. Bosses and mini-bosses
// are never moved, only slowed to half speed for 1.5 s. Refuses (charge kept) with no target.
registerItem({
  id: 'lasso_rope', name: 'Lasso Rope', desc: 'Yank the 3 nearest foes to you and stun them', type: 'active', charges: 3, pool: ['treasure', 'shop'], weight: 0.7,
  icon: { sheet: 'items2_e', name: 'lasso_rope' },
  tags: ['hex'], tier: 2, gate: 'occult',
  lore: 'Come here, friend.',
  hooks: { update(player, { dt }) { if (pulls.length) stepPull(player, dt); } },
  use(player, { scene }) {
    const px = player.x, py = player.y;
    const near = [];
    const bosses = [];
    for (const e of scene.enemies) {
      if (!e || !e.alive || e.spawnT > 0) continue;
      const d = Math.hypot(e.x - px, e.y - py);
      if (d > RANGE) continue;
      (e.isBoss ? bosses : near).push({ e, d });
    }
    if (!near.length && !bosses.length) return false;
    near.sort((a, b) => a.d - b.d);
    if (near.length > COUNT) near.length = COUNT;
    for (const { e } of bosses) {
      e.applyStatus('slow', { t: STUN, mult: BOSS_SLOW });
      scene.fx.ringPulse(e.x, e.y, 0xc8a878, 50, 300, 0.6);
    }
    endPull();
    for (const { e, d } of near) {
      e.applyStatus('stun', { t: STUN });
      const k = d > STOP ? STOP / d : 1; // never pushed away when already closer than 90 px
      pulls.push({ e, sx: e.x, sy: e.y, tx: px + (e.x - px) * k, ty: py + (e.y - py) * k });
    }
    if (pulls.length) {
      ropes = scene.add.graphics().setDepth(DEPTH.fx);
      ropes.__noSnap = true;
      pullT = 0; pullScene = scene;
    }
    Sfx.play('gun_cock', { vol: 0.6, rate: 0.7 });
    scene.fx.ringPulse(px, player.footY - 10, 0xc8a878, 90, 320, 0.7);
    scene.fx.text(px, py - 90, 'YEEHAW', { color: '#d9b071', size: 24 });
    return true;
  },
});
