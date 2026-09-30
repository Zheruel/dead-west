// Shared plumbing for the round-2 ground familiars (FE-I2): BoneHound, TumbleweedPal, LittleCoffin (SaintsHalo only uses the helpers).
//   Pet          Familiar subclass with a 2-frame `familiars_v2` sprite (cells named `<key>_a` / `<key>_b`, 6 fps flip), a shadow, hop / squash and
//                obstacle-aware movement (`walk` resolves against Room walls / rocks; familiars are invulnerable and never block bullets).
//   validTarget / nearestEnemy / bite   targeting + the damage call shared by hound, pal and bats (marks with Boneyard Pack, inherits the owner's
//                statuses with Pack Leader, like Bullets._inherit does for familiar bullets).
// Every visual goes through Assets.makeCell, so the pets exist as coloured placeholders under ?noassets=1 / ?dropassets=N.
import Familiar from './Familiar.js';
import { Assets } from '../../core/Assets.js';
import { ROOM, DEPTH, actorDepth } from '../../config.js';

export const SHEET = 'familiars_v2';
const MAX_STEP = 12; // px per collision sub-step (rocks are 96 px, pets have radius >= 14)

/** A live enemy a familiar may hurt. */
export const validTarget = (e) => !!e && e.alive && e.targetable && !(e.spawnT > 0) && !e.invulnerable;

/** Nearest valid enemy within `maxD` of (x, y), or null. Allocation-free. */
export function nearestEnemy(scene, x, y, maxD = 1e9) {
  const list = scene.enemies;
  let best = null, bd = maxD * maxD;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!validTarget(e)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/** Pack Leader (familiarInherit): the owner's burn / poison / chill / fear ride along on direct familiar hits. */
export function inheritStatuses(player, e) {
  const st = player.stats;
  if (!st.familiarInherit || !e.alive) return;
  if (st.burn > 0 && player.crng.chance(st.burn)) e.applyStatus('burn', { dps: 3 * st.burnDpsMult, t: 2.5 });
  if (st.poison > 0) e.applyStatus('poison', { dps: st.poison, t: 3, max: st.poisonStackMax });
  if (st.chillChance > 0 && player.crng.chance(st.chillChance)) e.applyStatus('chill', { t: 3 });
  if (st.fearChance > 0 && !e.isBoss && player.crng.chance(st.fearChance)) e.applyStatus('fear', { t: 2 });
}

/** One direct familiar hit: `dmg` (already scaled by familiarMult), knock along `angle`, Boneyard mark, Pack Leader statuses. Returns takeHit's result. */
export function bite(player, e, dmg, angle, src, knock = 1) {
  const res = e.takeHit(dmg, { x: e.x, y: e.y, angle, knock, familiar: true, source: src });
  if (res !== 'ignore' && e.alive) {
    if (player.stats.boneyard && !e.isBoss) e.applyStatus('mark', { t: 4 });
    inheritStatuses(player, e);
  }
  return res;
}

export class Pet extends Familiar {
  /**
   * o: {key: 'bone_hound' | 'tumble_pal' | 'coffin_pal', scale = 1, radius = 16, footOffset = 6, fps = 6, shadow = 0.32}
   * Subclasses implement tick(dt, player); the base handles fade-in, sprite frame flip, placement and cleanup.
   */
  constructor(player, o) {
    super(player);
    const s = this.scene;
    this.radius = o.radius ?? 16;
    this.flying = false;
    this.hit = false; this.hnx = 0; this.hny = 0; // Room.resolve() writes these
    this.footOffset = o.footOffset ?? 6;
    this.scale = o.scale ?? 1;
    this.t = 0;
    this.animT = 0;
    this.frameI = 0;
    this.fps = o.fps ?? 6;
    this.bob = 0; // extra lift in px (hop)
    this.squash = 0;
    this.faceLeft = false;
    const n = player.familiars.length;
    this.x += (n % 2 ? 1 : -1) * 70; this.y += 34; // spawn beside the player, not on top of it
    this.frames = [Assets.frame(SHEET, `${o.key}_a`), Assets.frame(SHEET, `${o.key}_b`)];
    this.shadow = this.own(s.add.image(0, 0, 'shadow').setScale(o.shadow ?? 0.32).setAlpha(0.5).setDepth(DEPTH.shadows));
    this.shadowBase = o.shadow ?? 0.32;
    this.sprite = this.own(Assets.makeCell(s, 0, 0, SHEET, `${o.key}_a`, 1).setScale(this.scale));
  }

  /** Move by velocity (vx, vy) * dt with wall / obstacle resolution in <= MAX_STEP sub-steps. Returns true when something blocked the move. */
  walk(vx, vy, dt) {
    const room = this.scene.room;
    const dx = vx * dt, dy = vy * dt;
    if (!room) { this.x += dx; this.y += dy; return false; }
    const n = Math.min(8, Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_STEP)));
    let blocked = false, nx = 0, ny = 0;
    for (let i = 0; i < n; i++) {
      this.x += dx / n; this.y += dy / n;
      room.resolve(this);
      if (this.hit) { blocked = true; nx += this.hnx; ny += this.hny; }
    }
    // keep inside the room rectangle (door gaps in the wall band would otherwise let a pet wander out); counts as a block
    const x0 = ROOM.x + this.radius, x1 = ROOM.right - this.radius, y0 = ROOM.y + this.radius, y1 = ROOM.bottom - this.radius - 4;
    if (this.x < x0) { this.x = x0; nx += 1; blocked = true; } else if (this.x > x1) { this.x = x1; nx -= 1; blocked = true; }
    if (this.y < y0) { this.y = y0; ny += 1; blocked = true; } else if (this.y > y1) { this.y = y1; ny -= 1; blocked = true; }
    this.hit = blocked;
    const l = Math.hypot(nx, ny);
    if (blocked && l > 1e-3) { this.hnx = nx / l; this.hny = ny / l; }
    return blocked;
  }

  /** Snap next to the player (room slide, stuck behind a rock) with a fade-in. */
  warpToPlayer(player) {
    const a = (this.t * 1.7 + player.familiars.indexOf(this) * 2.1) % 6.28;
    this.x = player.x + Math.cos(a) * 90; this.y = player.y + Math.sin(a) * 70 + 20;
    this.appear = 0;
    this.walk(0, 0, 0); // resolve out of walls
  }

  update(dt, player) {
    if (!this.alive) return;
    if (dt > 0.05) dt = 0.05;
    this.t += dt;
    this.appear = Math.min(1, this.appear + dt * 3);
    this.squash = Math.max(0, this.squash - dt);
    if (Math.hypot(player.x - this.x, player.y - this.y) > 560) this.warpToPlayer(player);
    if (!player.dead) this.tick(dt, player);
    this.animT += dt;
    if (this.animT >= 1 / this.fps) { this.animT = 0; this.frameI ^= 1; this.sprite.setFrame(this.frames[this.frameI]); }
    this.place();
  }

  tick(dt, player) {}

  place() {
    const a = Math.min(1, this.appear);
    const sq = this.squash > 0 ? 1 + this.squash * 1.6 : 1;
    const sp = this.sprite;
    sp.setPosition(this.x, this.y + this.footOffset - this.bob).setAlpha(a).setScale(this.scale / sq, this.scale * sq).setFlipX(this.faceLeft);
    sp.setDepth(actorDepth(this.y + this.footOffset));
    this.shadow.setPosition(this.x, this.y + this.footOffset - 2).setAlpha(0.5 * a).setScale(this.shadowBase * (1 - Math.min(0.4, this.bob / 90)));
  }
}
