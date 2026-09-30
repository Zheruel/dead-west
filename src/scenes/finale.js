// Title banners over the game (used by flow.js):
//   playBanner(scene, title, sub, opts)  a dimmed title card that fades in and out over live play ("CHAPTER I COMPLETE"); opts.freeze stops the simulation.
//   playFinale(scene, {title, sub})      the chapter-complete poster: world frozen, spirit lights drift up, banner, then GameScene.endRun('complete').
//                                        Fallback for the ending hand-off (game:ending) when no ending module handles it.
import { W, H, DEPTH, FONT_TITLE, FONT_BODY, ROOM } from '../config.js';
import { Sfx } from '../core/Audio.js';

const FIX = (o) => { o.setScrollFactor(0); o.__noSnap = true; return o; }; // screen-fixed (the camera lookahead must not move it), never captured by room slides

/**
 * Show a title card. Non-blocking by default. Returns a cancel() function; `opts.onDone` runs after the fade-out.
 * opts: { hold = 2600 (ms fully shown), dim = 0.45, freeze = false, sfx = true, onDone }
 */
export function playBanner(scene, title, sub = '', opts = {}) {
  const s = scene;
  const { hold = 2600, dim = 0.45, freeze = false, sfx = true, onDone } = opts;
  if (freeze) { s.cutscene = true; s.timeScale = 1; }
  const shade = FIX(s.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(DEPTH.ui - 20));
  const t = FIX(s.add.text(W / 2, H / 2 - 30, title, { fontFamily: FONT_TITLE, fontSize: '84px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 12, align: 'center', wordWrap: { width: W - 120 } }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0));
  const u = FIX(s.add.text(W / 2, H / 2 + 50, sub, { fontFamily: FONT_BODY, fontSize: '30px', color: '#f0a640', stroke: '#120c0a', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0));
  const parts = [shade, t, u];
  let dead = false;
  const cleanup = () => { if (dead) return; dead = true; s.tweens.killTweensOf(parts); for (const o of parts) o.destroy(); };
  s.tweens.add({ targets: shade, alpha: dim, duration: 900 });
  s.time.delayedCall(500, () => {
    if (dead) return;
    if (sfx) Sfx.play('room_clear', { vol: 0.8, rate: 0.7, gap: 0 });
    s.tweens.add({ targets: t, alpha: 1, scale: { from: 1.25, to: 1 }, duration: 700, ease: 'Cubic.easeOut' });
    s.tweens.add({ targets: u, alpha: 1, duration: 800, delay: 600 });
  });
  s.time.delayedCall(500 + hold, () => {
    if (dead) return;
    s.tweens.add({ targets: parts, alpha: 0, duration: 700, onComplete: () => { cleanup(); if (onDone) onDone(); } });
  });
  s.events.once('shutdown', cleanup);
  return cleanup;
}

/** Chapter-complete poster. The caller has already frozen the world (flow.endGame); this adds the spirit lights and hands over to endRun. */
export function playFinale(scene, { title = 'THE UNDERTAKER FALLS', sub = 'Perdition County is quiet. For now.' } = {}) {
  const s = scene;
  s.cutscene = true;
  s.timeScale = 1;
  s.bullets.clear();
  // drifting spirit lights (the graveyard lets go)
  s.time.addEvent({
    delay: 260, repeat: 12,
    callback: () => s.fx.burst(ROOM.x + Math.random() * ROOM.w, ROOM.bottom - Math.random() * 300, {
      color: [0x8fc23f, 0xc8f07a, 0x6fe0d0], count: 3, speed: [10, 50], angle: [250, 290], gravity: -40, life: [1200, 2200], scale: [2, 3.5], blend: 'ADD',
    }),
  });
  playBanner(s, title, sub, { hold: 6000, dim: 0.55 }); // stays up until endRun fades to black
  s.time.delayedCall(3800, () => s.endRun('complete'));
}
