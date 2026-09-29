// Pocket Watch effect: enemies, enemy bullets and boss scripts run at 40% speed (scene.enemyTimeScale) for a few REAL seconds while the
// player stays at full speed. Cool-blue multiply tint + expanding clock ring + ticking. Self-cleaning: ends on timeout, scene shutdown.
import Phaser from 'phaser';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';

export function startBulletTime(scene, seconds = 4, scale = 0.4) {
  const p = scene.player;
  if (scene._bulletTime) { scene._bulletTime.t = Math.max(scene._bulletTime.t, seconds); return scene._bulletTime; } // refresh
  const bt = { t: seconds, total: seconds, tick: 0, alt: false };
  scene._bulletTime = bt;
  scene.enemyTimeScale = scale;
  const tint = scene.add.rectangle(720, 480, 1440, 960, 0x6f8ed0, 1).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(DEPTH.overlay - 10).setAlpha(0);
  tint.__noSnap = true;
  const ring = scene.add.image(p.x, p.y - 30, 'ring').setTint(0xa0c0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlay - 9).setScale(0.3).setAlpha(0.9);
  ring.__noSnap = true;
  scene.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  scene.tweens.add({ targets: tint, alpha: 0.85, duration: 250 });
  scene.fx.flash(0xa0c0ff, 0.25);
  Sfx.play('pause', { vol: 0.8, rate: 0.7 });
  scene.fx.text(p.x, p.y - 90, 'BULLET TIME', { color: '#a0c0ff', size: 26 });

  const step = (time, delta) => {
    const dt = Math.min(delta / 1000, 0.25); // wall-clock seconds (not the capped game dt): a laggy machine cannot stretch the effect
    bt.t -= dt;
    bt.tick -= dt;
    if (bt.tick <= 0) { bt.tick = 0.5; bt.alt = !bt.alt; Sfx.play('step_wood', { vol: 0.3, rate: bt.alt ? 2.2 : 1.8, gap: 0.1 }); }
    if (bt.t < 1) tint.setAlpha(0.85 * (0.6 + 0.4 * Math.sin(bt.t * 30)) * Math.max(0.2, bt.t)); // flicker out
    if (bt.t <= 0) end(true);
  };
  const end = (audible) => {
    scene.events.off('update', step);
    scene.events.off('shutdown', onShut);
    scene._bulletTime = null;
    scene.enemyTimeScale = 1;
    if (audible) Sfx.play('pause', { vol: 0.7, rate: 1.5 });
    if (tint.scene) scene.tweens.add({ targets: tint, alpha: 0, duration: 250, onComplete: () => tint.destroy() });
  };
  const onShut = () => { scene.events.off('update', step); scene._bulletTime = null; };
  scene.events.on('update', step);
  scene.events.once('shutdown', onShut);
  return bt;
}
