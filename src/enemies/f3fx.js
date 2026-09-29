// Shared helpers for the Floor 3 (Sundown Mine) enemies: miner, bat, mole, coffin. NOT auto-registered (lives outside types/).
// Floor 3 floors are near-black, so the stock red warn ring is boosted with an additive glow disc + brighter tint.
import Phaser from 'phaser';
import { DEPTH } from '../config.js';

export const WARN_HOT = 0xff6a3a; // telegraph colour (orange-red, readable on black-brown rock)
export const WARN_DIRT = 0xffb050; // ground-erupt telegraphs (mole)
export const wrap = (a) => Phaser.Math.Angle.Wrap(a);

/** Dark-floor-safe warning circle. Returns {destroy()}. */
export function darkWarn(scene, x, y, radius, time, color = WARN_HOT) {
  const h = scene.fx.warnCircle(x, y, radius, time, color);
  const g = scene.add.image(x, y, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.decals + 5).setAlpha(0.05).setDisplaySize(radius * 3.1, radius * 3.1);
  scene.fx._track(g);
  scene.tweens.add({ targets: g, alpha: 0.6, duration: time * 1000, ease: 'Quad.easeIn', onComplete: () => { if (g.scene) g.destroy(); } });
  return { destroy() { h.destroy(); scene.tweens.killTweensOf(g); if (g.scene) g.destroy(); } };
}

/** Warning line with the same boost (bat dives). */
export function darkLine(scene, x1, y1, x2, y2, width, time, color = WARN_HOT) {
  return scene.fx.warnLine(x1, y1, x2, y2, width, time, color);
}

/** Expanding ground shockwave ring (visual only). */
export function shockRing(scene, x, y, radius, color = 0xffd0a0, time = 320) {
  const r = scene.add.image(x, y, 'ring').setTint(color).setDepth(DEPTH.decals + 8).setAlpha(0.9).setDisplaySize(radius * 0.4, radius * 0.4);
  scene.fx._track(r);
  scene.tweens.add({ targets: r, displayWidth: radius * 2.1, displayHeight: radius * 2.1, alpha: 0, duration: time, ease: 'Cubic.easeOut', onComplete: () => { if (r.scene) r.destroy(); } });
  return r;
}
