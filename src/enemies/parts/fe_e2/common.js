// FE-E2 helpers shared by magma_eel, sulfur_preacher and magma_golem (CHAPTER2 s3).
import { Assets } from '../../../core/Assets.js';
import { Sfx } from '../../../core/Audio.js';
import { subRng } from '../../../core/rng.js';
import { warnDepth } from '../../../rooms/hazards/common.js';

export { warnDepth };

/** Per-enemy seeded stream: same room + spawn point + id = same rolls (Daily fairness), independent of how the run played out. */
export function enemyRng(e) {
  const room = e.scene.room;
  return subRng('fe2', e.id, room && room.def ? room.def.seed : 0, Math.round(e.x), Math.round(e.y));
}

/** Play `key`, or `alt` while the real sound is not in the manifest yet (AUDIO_SPEC aliases land with FE-A1). */
export function sfx(key, alt, o) {
  if (Assets.hasAudio(key)) return Sfx.play(key, o);
  return alt ? Sfx.play(alt, o) : null;
}

const OFFS = [0.5, -0.5, 1.0, -1.0, 1.5, -1.5];

/**
 * Walkers that set their own velocity (keepDistance, strafing) skip the obstacle probe steerToward has: bend the current velocity around
 * solid tiles and hazards (lava, raised spikes) so a retreating support enemy is not walked into a river. Allocation-free.
 */
export function avoid(e) {
  const room = e.scene.room;
  if (!room || e.flying) return;
  const sp = Math.hypot(e.vx, e.vy);
  if (sp < 1) return;
  const a = Math.atan2(e.vy, e.vx), reach = e.radius + 36, pr = e.radius * 0.7;
  if (!room.probe(e.x + Math.cos(a) * reach, e.y + Math.sin(a) * reach, pr, e)) return;
  for (let i = 0; i < OFFS.length; i++) {
    const b = a + OFFS[i];
    if (!room.probe(e.x + Math.cos(b) * reach, e.y + Math.sin(b) * reach, pr, e)) { e.vx = Math.cos(b) * sp; e.vy = Math.sin(b) * sp; return; }
  }
  e.stop();
}
