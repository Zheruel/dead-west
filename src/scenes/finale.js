// Chapter finale (called by GameScene.onBossDefeated when the floor-3 boss dies, after the boss's own slow-mo death/explosion chain):
// the world freezes, spirit lights drift up, a title card fades in ("THE UNDERTAKER FALLS"), then GameScene.endRun('complete')
// fades to black and hands over to EndScene (chapter-complete variant: run stats, best time, 'To be continued...', mus_victory).
import { W, H, DEPTH, FONT_TITLE, FONT_BODY, ROOM } from '../config.js';
import { Sfx } from '../core/Audio.js';

export function playFinale(scene) {
  const s = scene;
  const room = s.room;
  if (room) { room.state.cleared = true; room.mode = 'done'; }
  if (s.run) { s.run.roomsCleared++; s.run.won = true; }
  s.cutscene = true; // freeze the simulation (enemies, bullets, input)
  s.timeScale = 1;
  const p = s.player;
  p.vx = p.vy = 0;
  p.setEntryInvuln(60);
  p.syncVisual();
  s.bullets.clear();

  // drifting spirit lights (the graveyard lets go)
  s.time.addEvent({
    delay: 260, repeat: 12,
    callback: () => s.fx.burst(ROOM.x + Math.random() * ROOM.w, ROOM.bottom - Math.random() * 300, {
      color: [0x8fc23f, 0xc8f07a, 0x6fe0d0], count: 3, speed: [10, 50], angle: [250, 290], gravity: -40, life: [1200, 2200], scale: [2, 3.5], blend: 'ADD',
    }),
  });

  const dim = s.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(DEPTH.ui - 20);
  const title = s.add.text(W / 2, H / 2 - 30, 'THE UNDERTAKER FALLS', { fontFamily: FONT_TITLE, fontSize: '84px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 12 }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0);
  const sub = s.add.text(W / 2, H / 2 + 50, 'Perdition County is quiet. For now.', { fontFamily: FONT_BODY, fontSize: '30px', color: '#f0a640', stroke: '#120c0a', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0);
  s.tweens.add({ targets: dim, alpha: 0.55, duration: 900 });
  s.time.delayedCall(500, () => {
    Sfx.play('room_clear', { vol: 0.8, rate: 0.7, gap: 0 });
    s.tweens.add({ targets: title, alpha: 1, scale: { from: 1.25, to: 1 }, duration: 700, ease: 'Cubic.easeOut' });
    s.tweens.add({ targets: sub, alpha: 1, duration: 800, delay: 600 });
  });
  s.time.delayedCall(3800, () => s.endRun('complete'));
}
