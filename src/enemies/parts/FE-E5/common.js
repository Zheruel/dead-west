// Shared helpers for the FE-E5 enemies (card_shark, loaded_die, slot_fiend). NOT auto-registered (lives outside types/).
import { subRng } from '../../../core/rng.js';

/** Per-enemy deterministic stream: seed-mates rolling the same room get the same behaviour rolls (pips, reels, roll directions). */
export function enemyRng(e, label = 'e5') {
  const room = e.scene.room;
  const seed = room && room.def ? room.def.seed : 0;
  return subRng(label, e.id, seed, Math.round(e.x), Math.round(e.y), e.scene.enemies.length);
}

/** Enemy-bullet speed factor the Bullets pool applies (difficulty x mutator), for drawing telegraphs that match the real path. */
export function bulletK(scene) {
  return (scene.diff ? scene.diff.mul('bulletSpeed') : 1) * ((scene.mut && scene.mut.enemyBulletSpeed) || 1);
}

/** Show a sprite frame directly (placeholder textures may have fewer than 6 frames: fall back to frame 0). Stops the loop anim. */
export function holdFrame(e, frame, label = 'hold') {
  const s = e.sprite;
  if (!s) return;
  e.pose = label;
  s.anims.stop();
  s.setFrame(s.texture.has(frame) ? frame : 0);
}
