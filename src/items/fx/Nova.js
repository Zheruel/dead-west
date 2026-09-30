// Holy nova (saints_halo, gideons_bible, avenging_angel): damage every enemy in `radius`, optionally wipe enemy bullets. Returns the number of kills.
import Phaser from 'phaser';
import { DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';

/** o: {radius=240, damage=10, wipe=true, color=0xfff0b0, source='nova', silent} */
export function nova(scene, x, y, o = {}) {
  const radius = o.radius ?? 240, damage = o.damage ?? 10, color = o.color ?? 0xfff0b0;
  let kills = 0;
  const list = scene.enemies;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (!e || !e.alive) continue;
    if (Math.hypot(e.x - x, e.y - y) > radius + e.hitRadius) continue;
    e.takeHit(damage, { x, y, angle: Math.atan2(e.y - y, e.x - x), knock: 1.5, holy: true, nova: true, source: o.source || 'nova' });
    if (!e.alive) kills++;
  }
  if (o.wipe !== false) scene.bullets.enemy.clearRadius(x, y, radius);
  if (!o.silent) {
    const fx = scene.fx;
    fx.ringPulse(x, y, color, radius * 0.9, 520, 0.9);
    fx.ringPulse(x, y, 0xffffff, radius * 0.55, 380, 0.7);
    fx.burst(x, y - 20, { color: [color, 0xffffff, 0xf0d060], count: 22, speed: [120, radius * 1.6], life: [300, 700], scale: [1.2, 2.8], blend: 'ADD' });
    fx.flash(color, 0.22);
    Sfx.play('explosion', { vol: 0.5, rate: 1.4, gap: 0.05 });
    if (Assets.has('fx_items')) {
      const img = Assets.makeCell(scene, x, y, 'fx_items', 'fx_nova').setDepth(DEPTH.fx + 1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.9);
      img.__noSnap = true;
      scene.tweens.add({ targets: img, scale: (radius * 2) / 128, alpha: 0, duration: 480, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
    }
  }
  return kills;
}
export default nova;
