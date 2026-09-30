// Enemy base class. Subclass in src/enemies/types/<id>.js and call registerEnemy(id, Class, meta).
//
// Override points:  init()  ai(dt)  onHit(dmg, info)  onDeath(info)  damageMultiplier(info)  onWallHit(nx, ny)
// Animation convention (sprite 'enemy_<id>', 6 frames): 0-3 move loop, 4 windup/telegraph, 5 attack.
import { ENEMY_DEFAULTS, FLOORS, FEEL, ROOM_REWARD } from '../config.js';
import Actor from '../entities/Actor.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { rng } from '../core/rng.js';
import { Affixes } from './Affixes.js';
import { onEnemyKilled } from '../items/fx/Kill.js';

const UNDEAD_IDS = new Set(['ghost', 'skeleton', 'possessed', 'coffin', 'miner', 'undertaker']); // 'undead' damage tag (silver bullets) regardless of meta.tags
const STATUS_TINT = { frozen: 0xd8f4ff, stun: 0xffe070, fear: 0xb070ff, burn: 0xff9040, poison: 0x9be060, chill: 0x9fd8ff, slow: 0x80b0ff, ward: 0xffe070 };
const TINT_ORDER = ['frozen', 'stun', 'fear', 'burn', 'poison', 'chill', 'slow'];
const ST = { burn: false, poison: false, chill: false, frozen: false, mark: false, fear: false }; // statuses-at-death snapshot (shared, never retained)
const AFFLICT = ['burn', 'poison', 'chill', 'mark', 'fear'];

/** Room tokens (`scene.token(name, max, owner)`): caps how many enemies do a thing at once (hound lunges, skull arming). Installed on first use. */
function installTokens(scene) {
  if (scene.token) return;
  const held = {};
  scene.token = (name, max = 1, owner = null) => {
    const set = held[name] || (held[name] = new Set());
    for (const e of set) if (!e.alive) set.delete(e);
    if (owner && set.has(owner)) return true;
    if (set.size >= max) return false;
    set.add(owner || {});
    return true;
  };
  scene.tokenRelease = (name, owner) => { if (held[name]) held[name].delete(owner); };
  scene.tokenClear = () => { for (const k of Object.keys(held)) held[k].clear(); };
}

export default class Enemy extends Actor {
  /**
   * opts: { id, meta, cursed, floor, hpMult, spriteKey, instant (short spawn-in), vx.. }
   */
  constructor(scene, x, y, opts = {}) {
    const meta = opts.meta || {};
    super(scene, x, y, { radius: meta.r ?? 28, flying: !!meta.flying, ghost: !!meta.ghost, footOffset: meta.foot });
    this.id = opts.id || 'enemy';
    this.meta = meta;
    this.floor = opts.floor || (scene.floorNum || 1);
    this.affixes = opts.affixes || (opts.cursed ? ['cursed'] : []);
    this.cursed = this.affixes.includes('cursed');
    this.noLoot = !!opts.noLoot;
    this.tags = meta.tags || [];
    this.isBoss = false;
    this.speed = meta.speed ?? 100;
    this.contactDamage = meta.contactDamage ?? ENEMY_DEFAULTS.contactDamage;
    this.knockback = meta.knockback ?? ENEMY_DEFAULTS.knockback;
    this.hitRadius = meta.hitR ?? this.radius;
    this.airHeight = meta.air ?? 0;
    this.invulnerable = false; // bullets pass through while true
    this.targetable = true;
    this.alive = true;
    this.noClear = false; // if true, room clear does not wait for it
    this.state = 'idle';
    this.stateTime = 0;
    this.knock = { x: 0, y: 0 };
    this.timers = [];
    this.status = {};
    this.flashT = 0;
    this.facingFlip = meta.flip !== false;
    this.pose = '';
    this.animKey = '';
    this.spawnT = opts.instant ? 0.25 : (meta.spawnTime ?? ENEMY_DEFAULTS.spawnTime) * 0.6;
    this.spawnDur = this.spawnT;
    this.tickT = 0;
    this.fxT = 0;
    this.stunResist = meta.stunResist ?? 0;
    this.wardT = 0; // > 0: takeHit x0.5 (Sulfur Ward, CHAPTER2 s2)
    this.aiScale = 1; // multiplies the dt handed to ai() (swift affix)
    this.marked = false; // Hunter's mark (WantedMark familiar)
    installTokens(scene);

    const fm = FLOORS[this.floor] ? FLOORS[this.floor].hpMult : 1;
    const bossLike = !!(meta.heavy && meta.noFloorScale); // Boss base class ctor meta
    const diff = scene.diff, mut = scene.mut;
    const dm = (diff ? diff.mul(bossLike ? 'bossHp' : 'enemyHp') : 1) * (mut && !bossLike ? mut.enemyHp : 1);
    const base = (meta.hp ?? 10) * (opts.hpMult ?? 1) * (meta.noFloorScale ? 1 : fm) * dm;
    this.maxHp = base;
    this.hp = this.maxHp;
    this.slowBase = !bossLike && mut ? mut.enemySpeed : 1; // mutator: enemies move faster (walk velocity multiplier)

    this.spriteKey = opts.spriteKey || meta.sprite || `enemy_${this.id}`;
    this.sprite = Assets.makeSprite(scene, x, y, this.spriteKey, 0);
    this.sprite.setAlpha(0);
    if (meta.scale) this.sprite.setScale(meta.scale);
    this.baseScale = meta.scale || 1;
    scene.enemies.push(this);
    this.setPose('move');
    this.init(opts);
    this.refreshTint();
    this.syncVisual();
    Affixes.apply(this); // elite rings / hp / tint / nameplate (owns cursed x1.5 hp and the aura)
    bus.emit('enemy:spawned', { enemy: this });
  }

  // ---------------------------------------------------------------------------------------------- override points
  init(opts) {}
  ai(dt) {}
  onHit(dmg, info) {}
  onDeath(info) {}
  onWallHit(nx, ny) {}
  /** Return a multiplier for incoming damage (e.g. armour from the front). */
  damageMultiplier(info) { return 1; }

  // ---------------------------------------------------------------------------------------------- helpers
  get player() { return this.scene.player; }
  get frozenAi() { return this.spawnT > 0 || this.status.stun; }
  /** A cooldown / delay in seconds scaled by the difficulty (Hell: x0.88). Use for attack timers. */
  cd(sec) { const d = this.scene.diff; return d ? sec * d.mul('cooldown') : sec; }
  /** Acquire / release a room-wide token (`scene.token`): true when this enemy may proceed. */
  takeToken(name, max = 1) {
    const ok = this.scene.token(name, max, this);
    if (ok) { const l = this._tokens || (this._tokens = []); if (!l.includes(name)) l.push(name); }
    return ok;
  }
  releaseToken(name) { if (this.scene.tokenRelease) this.scene.tokenRelease(name, this); }
  /** Walk-speed multiplier from slowing statuses (chill, slow) and the mutator; bosses ignore the mutator. */
  slowMult() {
    const st = this.status;
    let m = this.slowBase || 1;
    if (st.slow) m *= st.slow.mult;
    if (st.chill) m *= st.chill.mult;
    return m;
  }
  _afflictions() { let n = 0; for (let i = 0; i < AFFLICT.length; i++) if (this.status[AFFLICT[i]]) n++; return n; }
  setState(s) { this.state = s; this.stateTime = 0; }
  angleToPlayer() { return Math.atan2(this.player.y - this.y, this.player.x - this.x); }
  distToPlayer() { return Math.hypot(this.player.x - this.x, this.player.y - this.y); }
  /** Set walking velocity toward a point. */
  moveToward(tx, ty, speed = this.speed) {
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.vx = Math.cos(a) * speed; this.vy = Math.sin(a) * speed;
  }
  /** Set velocity along an angle. */
  moveAngle(a, speed = this.speed) { this.vx = Math.cos(a) * speed; this.vy = Math.sin(a) * speed; }
  stop() { this.vx = 0; this.vy = 0; }
  /** Velocity toward target with simple obstacle avoidance (walkers only). */
  steerToward(tx, ty, speed = this.speed) {
    let a = Math.atan2(ty - this.y, tx - this.x);
    const room = this.scene.room;
    if (room && !this.flying) {
      const probe = (ang) => room.probe(this.x + Math.cos(ang) * (this.radius + 36), this.y + Math.sin(ang) * (this.radius + 36), this.radius * 0.7, this);
      if (probe(a)) {
        for (const off of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
          if (!probe(a + off)) { a += off; break; }
        }
      }
    }
    this.vx = Math.cos(a) * speed; this.vy = Math.sin(a) * speed;
  }
  /** Approach/retreat to hold `dist` from the player (+ optional strafe -1/0/1). Sets velocity. */
  keepDistance(dist, strafe = 0, speed = this.speed, tol = 50) {
    const p = this.player;
    const a = this.angleToPlayer();
    const d = this.distToPlayer();
    let fx = 0, fy = 0;
    if (d > dist + tol) { fx = Math.cos(a); fy = Math.sin(a); } else if (d < dist - tol) { fx = -Math.cos(a); fy = -Math.sin(a); }
    fx += -Math.sin(a) * strafe; fy += Math.cos(a) * strafe;
    const l = Math.hypot(fx, fy);
    if (l > 0.01) { this.vx = (fx / l) * speed; this.vy = (fy / l) * speed; } else this.stop();
  }
  faceToward(x) { if (this.facingFlip && this.sprite) this.sprite.setFlipX(x < this.x); }

  /** Run fn after `sec` seconds of (enemy) time; auto-cancelled on death. Returns a handle. */
  after(sec, fn) { const t = { t: sec, fn, dead: false }; this.timers.push(t); return t; }
  /** Windup then callback: sets windup pose, flashes, calls fn(). */
  telegraph(sec, fn, { pose = 'windup', flash = true } = {}) {
    this.setPose(pose);
    if (flash) this.pulse(sec);
    return this.after(sec, fn);
  }
  pulse(sec) { this.pulseT = sec; this.pulseDur = sec; }

  /** Fire an enemy bullet from the body (offset toward angle). */
  shoot(angle, o = {}) {
    const off = o.offset ?? this.radius;
    return this.scene.bullets.enemy.fire({
      x: this.x + Math.cos(angle) * off, y: this.y + Math.sin(angle) * off - (o.up ?? 0),
      angle, speed: 320, damage: 1, kind: 'enemy', owner: this, ...o,
    });
  }

  /** 'move' loops frames 0-3, 'windup' = frame 4, 'attack' = frame 5. */
  setPose(p) {
    if (this.pose === p || !this.sprite) return;
    this.pose = p;
    if (p === 'move') {
      const key = Assets.ensureAnim(this.scene, this.spriteKey, { start: 0, end: 3, fps: this.meta.fps ?? 8, name: 'move' });
      this.sprite.play(key, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(p === 'windup' ? 4 : 5);
    }
  }

  // ---------------------------------------------------------------------------------------------- status effects
  /**
   * name: fear | stun | slow | poison | burn | chill | frozen | mark. o: {t seconds, dps, mult, max (poison stack cap), stack (false = refresh only)}.
   * status[name] = {t, dps, mult, stacks}.  chill x3 -> frozen (bosses: only slowed x0.85, never frozen); poison dps = dps * stacks.
   */
  applyStatus(name, o = {}) {
    if (!this.alive) return;
    const st = this.status;
    const cur = st[name];
    const t = o.t ?? 2;
    if (name === 'stun' && this.stunResist > 0 && Math.random() < this.stunResist) return;
    if (name === 'chill') {
      const stacks = this.isBoss ? 1 : Math.min(3, (cur ? cur.stacks : 0) + (o.stack === false ? 0 : 1));
      if (stacks >= 3 && !this.isBoss) { delete st.chill; this.applyStatus('frozen', { t: 1.2 }); this.refreshTint(); return; }
      st.chill = { t: Math.max(cur ? cur.t : 0, t), dps: 0, mult: this.isBoss ? 0.85 : 0.7, stacks: Math.max(1, stacks) };
    } else if (name === 'frozen') {
      if (this.isBoss) return;
      st.frozen = { t, dps: 0, mult: 1, stacks: 1 };
      st.stun = { t: Math.max(st.stun ? st.stun.t : 0, t), dps: 0, mult: 0.5, stacks: 1 }; // frozen = stunned (ignores stun resistance)
      this.scene.fx.ringPulse(this.x, this.y, 0x9fd8ff, 50, 300, 0.7);
    } else if (name === 'poison') {
      const max = o.max ?? 1;
      const stacks = Math.min(max, (cur ? cur.stacks : 0) + (o.stack === false ? 0 : 1));
      st.poison = { t: Math.max(cur ? cur.t : 0, t), dps: Math.max(cur ? cur.dps : 0, o.dps || 0), mult: 1, stacks: Math.max(1, stacks) };
    } else if (name === 'mark') {
      st.mark = { t: Math.max(cur ? cur.t : 0, t), dps: 0, mult: 1, stacks: 1 };
    } else {
      st[name] = { t: Math.max(cur ? cur.t : 0, t), dps: Math.max(cur ? cur.dps || 0 : 0, o.dps || 0), mult: o.mult ?? 0.5, stacks: 1 };
    }
    this.refreshTint();
  }
  refreshTint() {
    if (!this.sprite) return;
    if (this.flashT > 0) { this.sprite.setTintFill(0xffffff); return; }
    for (let i = 0; i < TINT_ORDER.length; i++) { const k = TINT_ORDER[i]; if (this.status[k]) { this.sprite.setTint(STATUS_TINT[k]); return; } }
    if (this.wardT > 0) { this.sprite.setTint(STATUS_TINT.ward); return; }
    const t = Affixes.tintOf(this);
    if (t != null) this.sprite.setTint(t); else this.sprite.clearTint();
  }
  updateStatus(dt) {
    let dirty = false;
    const st = this.status;
    for (const k in st) {
      const s = st[k];
      s.t -= dt;
      if (s.t <= 0) { delete st[k]; dirty = true; }
    }
    if (this.wardT > 0) { this.wardT -= dt; if (this.wardT <= 0) dirty = true; }
    this.tickT += dt;
    if (this.tickT >= 0.5) {
      this.tickT -= 0.5;
      const pz = st.poison, bn = st.burn;
      let dps = 0;
      if (pz) { dps += pz.dps * pz.stacks; if (bn && this.player && this.player.stats.witchesBrew) dps += pz.dps * pz.stacks; } // Witches' Brew: burning + poisoned = x2 poison
      if (bn) dps += bn.dps;
      if (dps > 0) this.hurt(dps * 0.5, { dot: true, poison: !!pz, burn: !!bn });
    }
    this.fxT -= dt;
    if (this.fxT <= 0 && (st.poison || st.burn || st.fear || st.chill || st.mark)) {
      this.fxT = 0.3;
      const col = st.burn ? [0xff9040, 0xffd060] : st.poison ? [0x9be060] : st.chill ? [0x9fd8ff, 0xffffff] : st.mark ? [0xd63a2a] : [0xb070ff];
      this.scene.fx.burst(this.x, this.y - 30, { color: col, count: 2, speed: [10, 50], life: [300, 500], scale: [1.5, 2.5], angle: [240, 300] });
    }
    if (dirty) this.refreshTint();
  }

  // ---------------------------------------------------------------------------------------------- damage
  /** Called by bullets/explosions. Returns 'ignore' if the hit did nothing (bullet passes through). */
  takeHit(dmg, info = {}) {
    if (!this.alive || this.invulnerable || this.spawnT > 0) return 'ignore';
    const p = this.player;
    const st = this.status;
    let d = dmg * this.damageMultiplier(info);
    if (p) {
      const s = p.stats;
      if (this.tags.includes('undead') || UNDEAD_IDS.has(this.id)) d *= s.undeadDamageMult || 1; // silver_bullets
      if (st.burn && s.burnVuln) d *= 1 + s.burnVuln; // brand_iron
      if (st.frozen) d *= 1 + s.frozenBonus;
      if (st.mark) d *= 1 + s.markBonus;
      if (this.marked) d *= this.isBoss ? s.markBossMult : s.markMult; // Hunter's mark
      if (s.elemTrinity && this._afflictions() >= 3) d *= 1.5;
    }
    if (this.wardT > 0) d *= 0.5;
    this._lastDmg = d;
    this.hurt(d, info);
    if (!this.alive) return 'hit';
    if (info.angle != null && !this.meta.heavy) {
      const f = this.knockback * (info.knock ?? 1);
      this.knock.x += Math.cos(info.angle) * f; this.knock.y += Math.sin(info.angle) * f;
    }
    const s = p ? p.stats : null;
    if (info.poison) this.applyStatus('poison', { dps: info.poison, t: 3, max: s ? s.poisonStackMax : 1 });
    if (info.burn) this.applyStatus('burn', { dps: 3 * (s ? s.burnDpsMult : 1), t: info.burnT || 2.5 });
    if (info.fear && !this.isBoss) this.applyStatus('fear', { t: 2 }); // bosses never flee (would break their attack scheduler)
    if (info.chill) this.applyStatus('chill', { t: 3 });
    return 'hit';
  }

  hurt(dmg, info = {}) {
    if (!this.alive) return;
    dmg *= Affixes.onDamage(this, dmg, info); // armored / shielded (may absorb it entirely)
    this.hp -= dmg;
    if (!info.dot) {
      if (dmg > 0) this.scene.fx.damageNumber(this.x, this.y - (this.hitRadius || 20) - 30, dmg, { crit: !!(info.sixth || info.deadEye) }); // settings.dmgNumbers
      this.flashT = 0.08;
      this.refreshTint();
      Sfx.play(this.isBoss ? 'boss_hit' : 'enemy_hit', { vol: 0.7, detune: (Math.random() - 0.5) * 300 });
      bus.emit('enemy:hit', { enemy: this, damage: dmg });
      this.hitFeedback(info);
    }
    this.onHit(dmg, info);
    if (this.hp <= 0) this.die(info);
  }

  /** Release every room token this enemy holds (called on destroy). */
  releaseTokens() { if (this.scene.tokenRelease) for (const n of this._tokens || []) this.scene.tokenRelease(n, this); }

  /** Squash + directional sparks + blood specks (+ tiny hit-stop / kick for the Sixth Bullet). Called for every non-DoT hit. */
  hitFeedback(info) {
    const fx = this.scene.fx;
    if (!this.isBoss && this.sprite && !this.squashT) {
      this._sq0 = { x: this.sprite.scaleX, y: this.sprite.scaleY };
      this.squashT = this.squashDur = 0.14;
    } else if (this.squashT) this.squashT = this.squashDur;
    const hasDir = info.angle != null;
    const px = info.x ?? this.x, py = info.y ?? this.y;
    const ang = hasDir ? info.angle : Math.random() * 6.28;
    if (info.explosion) return;
    fx.spark(px, py - (info.bullet ? info.bullet.lift * 0.6 : 20), ang, !!info.sixth);
    fx.burst(px, py - 24, { color: [0x8a1c1c, 0xd63a2a], count: info.sixth ? 8 : 4, speed: [90, 260], life: [200, 420], scale: [1.5, 3], gravity: 420, dir: ang, spread: 38 });
    if (info.sixth) { fx.hitStop(35); fx.shake(0.006, 90); }
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    const s = this.scene;
    const stt = this.status;
    ST.burn = !!stt.burn; ST.poison = !!stt.poison; ST.chill = !!stt.chill; ST.frozen = !!stt.frozen; ST.mark = !!stt.mark; ST.fear = !!stt.fear;
    const i = s.enemies.indexOf(this);
    if (i >= 0) s.enemies.splice(i, 1);
    if (s.run) s.run.kills++;
    s.fx.deathPuff(this.x, this.y - 10, Math.max(0.8, this.radius / 36));
    const bs = Math.max(0.95, this.radius / 30); // pool of blood + one satellite splat
    s.fx.decal(this.x, this.y + 6, 'blood', bs);
    if (!info.silent) s.fx.decal(this.x + (Math.random() - 0.5) * 70, this.y + 6 + (Math.random() - 0.3) * 40, 'blood', bs * 0.45);
    s.fx.burst(this.x, this.y - 30, { color: [0x8a1c1c, 0xd63a2a, 0xe8dcc0], count: 10, speed: [90, 300], gravity: 300 });
    if (!info.silent) {
      s.fx.burst(this.x, this.y - 24, { color: [0xe8dcc0, 0xc9b98f], count: 7, speed: [120, 340], life: [450, 850], scale: [1.2, 2.2], gravity: 620 }); // bone chips
      if (info.angle != null) s.fx.burst(this.x, this.y - 24, { color: [0x8a1c1c, 0xb02a20], count: 8, speed: [180, 420], life: [250, 500], scale: [1.5, 3.2], gravity: 380, dir: info.angle, spread: 30 }); // blood spray along the killing shot
      s.fx.dust(this.x, this.y + 14, Math.max(0.6, this.radius / 44));
    }
    if (info.sixth) s.fx.hitStop(40);
    else s.fx.hitStop(20);
    this.dropLoot();
    try { Affixes.onDeath(this, info); } catch (e) { console.error(e); }
    try { this.onDeath(info); } catch (e) { console.error(e); }
    try { onEnemyKilled(this, info, ST); } catch (e) { console.error(e); }
    const by = info.sixth ? 'sixth' : info.deadEye ? 'deadeye' : info.explosion ? 'explosion' : info.dot ? 'dot' : info.familiar || (info.source && info.source.isFamiliar) ? 'familiar' : info.bullet ? 'bullet' : 'other';
    bus.emit('enemy:died', { enemy: this, x: this.x, y: this.y, cursed: this.cursed, boss: this.isBoss, id: this.id, by, elite: this.affixes.length > 0, affixes: this.affixes, marked: !!this.marked, info, st: ST });
    this.destroy();
  }

  dropLoot() {
    const room = this.scene.room;
    if (!room || this.isBoss || this.noLoot) return;
    if (this.scene.mut && this.scene.mut.noCoinDrops) return;
    const r = rng.game;
    const st = this.player ? this.player.stats : null;
    // the cursed heart is dropped by Affixes.onDeath
    if (r.chance(ROOM_REWARD.enemyCoin + (st ? st.luck * 0.01 + (st.coinDropBonus || 0) : 0))) room.dropPickup(r.chance(ROOM_REWARD.enemyNickel) ? 'coin_nickel' : 'coin', this.x, this.y);
  }

  // ---------------------------------------------------------------------------------------------- frame update
  update(dt) {
    if (!this.alive) return;
    this.stateTime += dt;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.refreshTint(); }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); if (!t.dead) t.fn(); }
    }
    if (!this.alive) return;
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      const k = 1 - Math.max(0, this.spawnT) / this.spawnDur;
      this.sprite.setAlpha(k);
      this.syncVisual();
      return;
    }
    this.sprite.setAlpha(this.alphaOverride ?? 1);
    if (this.squashT > 0) {
      this.squashT -= dt;
      const k = Math.max(0, this.squashT / this.squashDur), q = FEEL.hitSquash * k * k, b = this._sq0;
      if (this.squashT <= 0) { this.squashT = 0; this.sprite.setScale(b.x, b.y); } else this.sprite.setScale(b.x * (1 + q), b.y * (1 - q * 0.9));
    }
    if (this.pulseT > 0) {
      this.pulseT -= dt;
      const on = Math.floor((this.pulseDur - this.pulseT) * 18) % 2 === 0;
      if (this.flashT <= 0) { if (on) this.sprite.setTint(0xffc0a0); else this.refreshTint(); }
      if (this.pulseT <= 0) this.refreshTint();
    }
    this.updateStatus(dt);
    if (!this.alive) return;
    Affixes.update(this, dt);

    const stunned = !!this.status.stun;
    if (stunned) { this.stop(); }
    else if (this.status.fear && this.player) {
      const a = this.angleToPlayer() + Math.PI;
      this.moveAngle(a, Math.max(this.speed, 120) * 1.1);
    } else this.ai(dt * (this.aiScale || 1));
    if (!this.alive) return;

    const slow = this.slowMult();
    this.knock.x *= Math.exp(-dt * 8); this.knock.y *= Math.exp(-dt * 8);
    this.moveBy((this.vx * slow + this.knock.x) * dt, (this.vy * slow + this.knock.y) * dt);
    if (this.hit) this.onWallHit(this.hnx, this.hny);

    // contact damage
    const p = this.player;
    if (this.contactDamage > 0 && p && p.canBeHit()) {
      const rr = p.hurtRadius + this.radius * 0.85;
      if ((p.x - this.x) ** 2 + (p.y - this.y) ** 2 < rr * rr) p.damage(this.contactDamage, { x: this.x, y: this.y, enemy: this, enemyName: this.id, kind: 'contact' });
    }
    this.syncVisual();
  }

  destroy() {
    this.alive = false;
    this.timers.length = 0;
    Affixes.cleanup(this);
    this.releaseTokens();
    const i = this.scene.enemies.indexOf(this);
    if (i >= 0) this.scene.enemies.splice(i, 1);
    super.destroy();
  }
}
