// What happens when an enemy dies, item-wise (called by Enemy.die, ITEMS 2.4): the `kill` hook, ice shatter, toxic cloud, burn spread / pools,
// hellstorm, kill heals, Sixth refunds, explosion refunds and Queen jackpot coins. `st` = shared statuses-at-death snapshot (do not keep it).
import { CTX, runHooks, hasHook } from '../hooks.js';
import { explode } from '../../systems/Explosions.js';
import { itemFx } from './ItemFx.js';
import { firePool } from './FirePool.js';
import { isUndead } from './Smite.js';

const TAU = Math.PI * 2;

export function onEnemyKilled(enemy, info, st) {
  const scene = enemy.scene, p = scene.player;
  if (!p || p.dead || !p.stats) return;
  const s = p.stats;
  const x = enemy.x, y = enemy.y;
  if (hasHook(p, 'kill')) { const c = CTX.kill; c.enemy = enemy; c.info = info; c.st = st; runHooks(p, 'kill', c); c.enemy = null; c.info = null; c.st = null; }

  // frozen victims shatter into 5 ice shards (40% of the killing blow)
  if (st.frozen && !info.shard) {
    const dmg = Math.max(1, (enemy._lastDmg || 4) * 0.4);
    const a0 = p.crng.next() * TAU;
    for (let i = 0; i < 5; i++) {
      scene.bullets.player.fire({ x, y: y - 10, angle: a0 + (i / 5) * TAU, speed: 560, damage: dmg, life: 0.32, size: 0.7, child: true, frame: 'bullet_ice', tint: 0x9fd8ff, chill: 0, shard: true, source: p });
    }
    scene.fx.burst(x, y - 24, { color: [0xd8f4ff, 0x9fd8ff, 0xffffff], count: 14, speed: [80, 300], life: [250, 550], scale: [1, 2.4], blend: 'ADD' });
    scene.fx.ringPulse(x, y, 0x9fd8ff, 70, 300, 0.7);
  }
  if (st.poison && s.poisonCloud > 0) { itemFx(scene).cloud(x, y, s.poisonCloud, 3, 4); scene.fx.ringPulse(x, y, 0x8fd040, s.poisonCloud * 0.8, 420, 0.6); }
  if (st.burn) {
    if (s.burnSpread > 0) {
      const list = scene.enemies;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === enemy || !e.alive) continue;
        if (Math.hypot(e.x - x, e.y - y) < s.burnSpread + e.hitRadius) e.applyStatus('burn', { dps: 3 * (s.burnDpsMult || 1), t: 2.5 });
      }
      scene.fx.ringPulse(x, y, 0xff8a40, s.burnSpread * 0.9, 380, 0.6);
    }
    if (s.burnPoolR > 0) firePool(scene, x, y, s.burnPoolR, 3, { dps: 6, hurtsPlayer: !!s.burnPoolHurts });
    if (s.hellstorm && info.source !== 'hellstorm') explode(scene, x, y, { radius: 100, damage: 20, hurtPlayer: false, breakObstacles: false, revealSecrets: false, shake: false, owner: 'player', source: 'hellstorm', noCluster: true, noFire: true });
  }

  // heals: killHeal >= 1 = "every N kills" (pale_horse mutator), < 1 = chance per kill (leech_contract), at most one per 0.25 s
  if (s.killHeal > 0 && p.hp < p.maxHp) {
    if (s.killHeal >= 1) { p._killN = (p._killN || 0) + 1; if (p._killN >= s.killHeal) { p._killN = 0; p.heal(1); } } else if (p.time - (p._killHealT || -9) > 0.25 && p.crng.chance(s.killHeal)) { p._killHealT = p.time; p.heal(1); }
  }
  if (info.sixth && s.sixthKillHeal > 0 && p.hp < p.maxHp && p.crng.chance(s.sixthKillHeal)) p.heal(1);
  // widowmaker: a Sixth Bullet kill loads the next chamber with another Sixth (rate limited)
  if (info.sixth && s.sixthRefund > 0 && p.time - (p._refundT || -9) > 0.15 && p.crng.chance(s.sixthRefund)) { p._refundT = p.time; p.cyl.pos = s.sixthEvery - 1; p.syncCylinder(); }
  // consecrated_ground: the dead may leave a half heart
  if (s.undeadHeartDrop > 0 && scene.room && !(scene.mut && scene.mut.noHearts) && isUndead(enemy) && p.crng.chance(s.undeadHeartDrop)) scene.room.dropPickup('heart_half', x, y, { pop: true });
  // Queen: a Sixth Bullet (jackpot) kill drops coins
  if (info.sixth && s.jackpotKillCoins > 0 && scene.room) for (let i = 0; i < s.jackpotKillCoins; i++) scene.room.dropPickup('coin', x + (i - (s.jackpotKillCoins - 1) / 2) * 26, y + 8, { pop: true });
  // blast refund: a player explosion kill may return the stick
  if (info.explosion && info.owner === 'player' && s.dynamiteRefund > 0 && p.dynamite < 99 && p.crng.chance(s.dynamiteRefund)) {
    p.dynamite++;
    scene.fx.text(x, y - 60, '+1 DYNAMITE', { color: '#f0a640', size: 20 });
  }
}
