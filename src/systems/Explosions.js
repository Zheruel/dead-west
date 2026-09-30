// Area damage helper used by dynamite, dynamiter enemy, powder keg, boss slams, blasting caps, hellfire rounds...
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { CTX, runHooks, hasHook } from '../items/hooks.js';
import { firePool } from '../items/fx/FirePool.js';

/**
 * explode(scene, x, y, opts)
 * opts: radius=150, damage=60 (enemies), playerDamage=2 (units; 0 = never), hurtEnemies=true, hurtPlayer=true,
 *       breakObstacles=true, revealSecrets=true, shake=true, source,
 *       owner='enemy'|'player' (player-owned blasts feed the item engine: fire pools, clusters, refunds, `explosion` hook),
 *       exclude (an enemy that takes no damage, e.g. the victim of a blasting cap), burn (seconds of burn applied to every enemy hit), sixth (kills count as Sixth kills),
 *       noFire / noCluster (mini blasts: no nitro fire, no cluster), depth (internal: cluster recursion guard)
 * Returns the number of enemies killed.
 */
export function explode(scene, x, y, o = {}) {
  const radius = o.radius ?? 150;
  const damage = o.damage ?? 60;
  const player = scene.player;
  const mine = o.owner === 'player';
  scene.fx.explosion(x, y, radius);
  Sfx.play('explosion', { gap: 0.05 });
  bus.emit('explosion', { x, y, radius });
  if (o.shake !== false) scene.fx.hitStop(60);
  let kills = 0;
  if (o.hurtEnemies !== false) {
    const list = scene.enemies;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (!e || !e.alive || e === o.exclude) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.hitRadius) {
        e.takeHit(damage, { x, y, angle: Math.atan2(e.y - y, e.x - x), explosion: true, knock: 3, source: o.source, owner: o.owner, sixth: !!o.sixth, burn: o.burn ? 1 : 0, burnT: o.burn || 0 });
        if (!e.alive) kills++;
      }
    }
  }
  if (o.hurtPlayer !== false && player && !player.dead) {
    const d = Math.hypot(player.x - x, player.y - y);
    const pd = o.playerDamage ?? 2;
    if (pd > 0 && d < radius + player.hurtRadius * 0.5) player.damage(pd, { x, y, explosion: true, kind: mine ? 'own_dynamite' : (o.kind || 'explosion') });
  }
  const room = scene.room;
  if (room) {
    if (o.breakObstacles !== false) room.explodeAt(x, y, radius);
    if (o.revealSecrets !== false) room.revealSecretsAt(x, y, radius);
    if (room.onExplosion) room.onExplosion(x, y, radius, o);
  }
  // chain-react other lit dynamite
  for (const d of [...scene.dynamites]) if (d.alive && Math.hypot(d.x - x, d.y - y) < radius) d.fuse = Math.min(d.fuse, 0.15);
  if (mine && player) playerBlast(scene, player, x, y, radius, damage, o, kills);
  return kills;
}

/** Item-engine reactions to a player-owned blast (ITEMS 2.5, 5.1 fireworks, 5.3 hellstorm). */
function playerBlast(scene, player, x, y, radius, damage, o, kills) {
  const s = player.stats;
  if (!o.noFire && s.dynamiteFirePool) firePool(scene, x, y, radius * 0.5, 3 + (s.hellstorm ? 2 : 0), { dps: 6 });
  if (s.hellstorm && !o.noFire) { // every player explosion ignites all enemies inside for 4 s
    for (const e of scene.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) < radius + e.hitRadius) e.applyStatus('burn', { dps: 3 * (s.burnDpsMult || 1), t: 4 });
  }
  if (!o.noCluster && s.dynamiteCluster > 0 && (o.depth || 0) < 1) {
    for (let i = 0; i < s.dynamiteCluster; i++) {
      scene.time.delayedCall(150 * (i + 1), () => {
        if (!scene.player || scene.player.dead || !scene.room) return;
        const a = player.crng.next() * Math.PI * 2, r = Math.sqrt(player.crng.next()) * radius * 1.2;
        explode(scene, x + Math.cos(a) * r, y + Math.sin(a) * r, { radius: radius * 0.6, damage: damage * 0.4, hurtPlayer: false, breakObstacles: false, revealSecrets: false, shake: false, owner: 'player', source: 'cluster', noCluster: true, depth: 1 });
      });
    }
  }
  if (hasHook(player, 'explosion')) {
    const c = CTX.explosion;
    c.x = x; c.y = y; c.radius = radius; c.source = o.source || null; c.owner = 'player'; c.kills = kills;
    runHooks(player, 'explosion', c);
  }
}
