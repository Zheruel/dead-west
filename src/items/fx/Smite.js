// Smite (holy_water): a pillar of holy light at an enemy, AoE damage `damage` in `radius` (undead take undeadDamageMult via Enemy.takeHit; x2 more vs undead).
import Phaser from 'phaser';
import { DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';

const UNDEAD_IDS = new Set(['ghost', 'skeleton', 'possessed', 'coffin', 'miner', 'undertaker']);
export const isUndead = (e) => UNDEAD_IDS.has(e.id) || (e.tags && e.tags.includes('undead'));

/** Returns the number of kills. `x,y` = pillar position (the victim). */
export function smite(scene, x, y, damage, radius, killsOut) {
  let kills = 0;
  const list = scene.enemies;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (!e || !e.alive || Math.hypot(e.x - x, e.y - y) > radius + e.hitRadius) continue;
    e.takeHit(isUndead(e) ? damage * 2 : damage, { x, y, knock: 0.3, holy: true, smite: true });
    if (!e.alive) { kills++; if (killsOut) killsOut.push(e); }
  }
  const fx = scene.fx;
  Sfx.play('item_get', { vol: 0.35, rate: 1.6, gap: 0.1 });
  fx.ringPulse(x, y + 10, 0xfff0b0, radius, 360, 0.8);
  if (Assets.has('fx_items')) {
    const img = Assets.makeCell(scene, x, y + 20, 'fx_items', 'fx_holy_pillar', 1).setDepth(DEPTH.fx + 1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8, 1.6).setAlpha(0.95);
    img.__noSnap = true;
    scene.tweens.add({ targets: img, alpha: 0, scaleX: 0.3, duration: 380, onComplete: () => img.destroy() });
  } else {
    const beam = scene.add.image(x, y + 10, 'px').setOrigin(0.5, 1).setTint(0xfff0b0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx + 1).setDisplaySize(radius * 0.5, 420).setAlpha(0.8);
    beam.__noSnap = true;
    scene.tweens.add({ targets: beam, alpha: 0, displayWidth: radius * 0.15, duration: 380, onComplete: () => beam.destroy() });
  }
  fx.burst(x, y - 10, { color: [0xfff0b0, 0xffffff], count: 10, speed: [40, 200], life: [250, 550], scale: [1, 2.4], blend: 'ADD', gravity: -80 });
  return kills;
}
export default smite;
