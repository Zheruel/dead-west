// Area damage helper used by dynamite, dynamiter enemy, powder keg, boss slams...
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';

/**
 * explode(scene, x, y, opts)
 * opts: radius=150, damage=60 (enemies), playerDamage=2 (units; 0 = never), hurtEnemies=true, hurtPlayer=true,
 *       breakObstacles=true, revealSecrets=true, shake=true, source
 */
export function explode(scene, x, y, o = {}) {
  const radius = o.radius ?? 150;
  const damage = o.damage ?? 60;
  const player = scene.player;
  scene.fx.explosion(x, y, radius);
  Sfx.play('explosion', { gap: 0.05 });
  bus.emit('explosion', { x, y, radius });
  if (o.shake !== false) scene.fx.hitStop(60);
  if (o.hurtEnemies !== false) {
    for (const e of [...scene.enemies]) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.hitRadius) e.takeHit(damage, { x, y, angle: Math.atan2(e.y - y, e.x - x), explosion: true, knock: 3, source: o.source });
    }
  }
  if (o.hurtPlayer !== false && player && !player.dead) {
    const d = Math.hypot(player.x - x, player.y - y);
    const pd = o.playerDamage ?? 2;
    if (pd > 0 && d < radius + player.hurtRadius * 0.5) player.damage(pd, { x, y, explosion: true });
  }
  const room = scene.room;
  if (room) {
    if (o.breakObstacles !== false) room.explodeAt(x, y, radius);
    if (o.revealSecrets !== false) room.revealSecretsAt(x, y, radius);
  }
  // chain-react other lit dynamite
  for (const d of [...scene.dynamites]) if (d.alive && Math.hypot(d.x - x, d.y - y) < radius) d.fuse = Math.min(d.fuse, 0.15);
}
