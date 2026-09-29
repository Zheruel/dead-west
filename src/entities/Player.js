// The cursed gunslinger. Single source of truth for stats: player.stats (rebuilt by recomputeStats()).
import Phaser from 'phaser';
import { PLAYER, PLAYER_BASE, DEPTH, actorDepth } from '../config.js';
import Actor from './Actor.js';
import Dynamite from './Dynamite.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { rng } from '../core/rng.js';
import { getItem } from '../items/registry.js';
import { approach, rad } from '../core/util.js';

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export default class Player extends Actor {
  constructor(scene, x, y) {
    super(scene, x, y, { radius: PLAYER.radius, footOffset: 14, shadowScale: 0.62 });
    this.hurtRadius = PLAYER.hurtRadius;
    this.stats = { ...PLAYER_BASE };
    this.items = []; // item ids, in pickup order (duplicates allowed)
    this.buffs = []; // temporary stat modifiers {id, apply(stats,player), t}
    this.familiars = []; // objects with update(dt, player), destroy(), optional blocksBullets/x/y/radius
    this.active = null; // {id, charge, max}
    this.coins = PLAYER.startCoins;
    this.keys = PLAYER.startKeys;
    this.dynamite = PLAYER.startDynamite;
    this.hp = 6; // red HP units (2 per heart container)
    this.tin = 0; // tin (armour) units, 2 per tin heart
    this.dead = false;
    this.godMode = false;
    this.recomputeStats();
    this.hp = this.maxHp;

    // state
    this.facing = 'down';
    this.fireCd = 0;
    this.shotCount = 0; // total shots this run
    this.cylinder = { loaded: 6, max: 6 };
    this.lastShotAt = -99;
    this.time = 0;
    this.firePoseT = 0;
    this.hurtT = 0; // post-hit i-frames
    this.entryInv = 0; // room-entry invulnerability
    this.rolling = false;
    this.rollT = 0;
    this.rollCd = 0;
    this.rollDir = { x: 0, y: 1 };
    this.rollDustT = 0;
    this.knock = { x: 0, y: 0 };
    this.forced = null; // {x,y,t}: scripted walk (room entry)
    this.shieldLeft = 0; this.shieldRest = 0;
    this.deathT = 0;
    this.locked = false; // input locked (transitions, cutscenes)
    this._anim = '';

    this.sprite = Assets.makeSprite(scene, x, y, 'player_walk_down', 0);
    this.cdGfx = scene.add.graphics().setDepth(DEPTH.shadows + 3);
    this.cdGfx.__noSnap = true;
    this.sprite.__noSnap = true;
    this.shadow.__noSnap = true;
    this.syncVisual();
  }

  get maxHp() { return this.stats.maxHearts * 2; }
  get totalHearts() { return this.stats.maxHearts + Math.ceil(this.tin / 2); }
  get invulnerable() { return this.hurtT > 0 || this.entryInv > 0 || (this.rolling && this.rollT > 0); }

  /** Objects excluded from room-transition snapshots. */
  get noSnapObjects() { return [this.sprite, this.shadow, this.cdGfx]; }

  // ------------------------------------------------------------------------------------------------ stats / items
  /** Rebuild player.stats = PLAYER_BASE + every owned item's apply() + temporary buffs. Cheap; call whenever inputs change. */
  recomputeStats() {
    const s = this.stats;
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, PLAYER_BASE);
    const counts = {};
    for (const id of this.items) {
      const def = getItem(id);
      if (!def || !def.apply) continue;
      counts[id] = (counts[id] || 0) + 1;
      def.apply(this, { stats: s, count: counts[id], scene: this.scene, player: this });
    }
    // late phase: items whose bonus depends on the final stats (e.g. liquid_courage reads maxHearts) run after every normal apply()
    const lc = {};
    for (const id of this.items) {
      const def = getItem(id);
      if (!def || !def.applyLate) continue;
      lc[id] = (lc[id] || 0) + 1;
      def.applyLate(this, { stats: s, count: lc[id], scene: this.scene, player: this });
    }
    for (const b of this.buffs) b.apply(s, this);
    s.maxHearts = clampN(Math.round(s.maxHearts), 1, PLAYER.maxHearts);
    s.fireDelay = Math.max(0.07, s.fireDelay);
    s.damage = Math.max(0.5, s.damage);
    s.moveSpeed = clampN(s.moveSpeed, 120, 620);
    s.range = Math.max(0.15, s.range);
    s.bulletCount = Math.max(1, Math.round(s.bulletCount));
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    const tinCap = Math.max(0, PLAYER.maxHearts - s.maxHearts) * 2;
    if (this.tin > tinCap) this.tin = tinCap;
    bus.emit('player:stats', { stats: s });
    return s;
  }

  /** Give an item: registers it, runs onPickup once, recomputes stats. Actives replace the current active (old one is returned). */
  addItem(id) {
    const def = getItem(id);
    if (!def) { console.warn('[Player] unknown item', id); return null; }
    let prev = null;
    if (def.type === 'active') {
      prev = this.active ? this.active.id : null;
      this.active = { id, charge: 0, max: def.charges ?? 3 };
      bus.emit('active:changed', { ...this.active });
    } else this.items.push(id);
    const count = this.items.filter((i) => i === id).length;
    this.recomputeStats();
    if (def.onPickup) def.onPickup(this, { stats: this.stats, count, scene: this.scene, player: this });
    if (def.type === 'active') this.recomputeStats();
    return prev;
  }
  removeItem(id) {
    const i = this.items.indexOf(id);
    if (i >= 0) { this.items.splice(i, 1); this.recomputeStats(); }
  }
  hasItem(id) { return this.items.includes(id) || (this.active && this.active.id === id); }

  /** Temporary stat modifier. apply(stats, player) mutates the stats copy. `t` seconds (or Infinity until removeBuff). */
  addBuff(id, apply, t = 10) {
    this.buffs = this.buffs.filter((b) => b.id !== id);
    this.buffs.push({ id, apply, t });
    this.recomputeStats();
  }
  removeBuff(id) { this.buffs = this.buffs.filter((b) => b.id !== id); this.recomputeStats(); }
  addFamiliar(f) { this.familiars.push(f); return f; }

  addCharge(n = 1) {
    if (!this.active) return;
    const before = this.active.charge;
    this.active.charge = Math.min(this.active.max, this.active.charge + n);
    if (this.active.charge !== before) bus.emit('active:changed', { ...this.active });
  }
  useActive() {
    if (!this.active || this.dead) return false;
    if (this.active.charge < this.active.max) { Sfx.play('door_locked', { vol: 0.5, gap: 0.3 }); return false; }
    const def = getItem(this.active.id);
    if (!def || !def.use) return false;
    const ok = def.use(this, { stats: this.stats, scene: this.scene, player: this });
    if (ok === false) return false;
    this.active.charge = 0;
    bus.emit('active:changed', { ...this.active });
    return true;
  }

  // ------------------------------------------------------------------------------------------------ hearts
  heal(units) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + units);
    const d = this.hp - before;
    if (d > 0) {
      this.recomputeStats(); bus.emit('player:healed', { units: d });
      const fx = this.scene.fx;
      if (fx && !this.dead) {
        fx.burst(this.x, this.y - 20, { color: [0xff8a7a, 0xffd8c8, 0xffffff], count: 5 + d * 3, speed: [30, 120], life: [420, 850], scale: [1, 2.2], gravity: -140, blend: 'ADD' }); // rising sparkles
        fx.ringPulse(this.x, this.footY, 0xff8a7a, 44, 420, 0.6);
      }
    }
    return d;
  }
  addTin(units) {
    const cap = Math.max(0, PLAYER.maxHearts - this.stats.maxHearts) * 2;
    const before = this.tin;
    this.tin = Math.min(cap, this.tin + units);
    return this.tin - before;
  }
  canBeHit() { return !this.dead && !this.godMode && !this.invulnerable; }

  /** Take `units` of damage (1 = half heart). Tin first. Returns true if damage was applied. */
  damage(units, source = {}) {
    if (!this.canBeHit()) return false;
    if (source.explosion && this.stats.explosionImmune) return false;
    if (this.shieldLeft > 0) {
      this.shieldLeft--; this.shieldRest = 1; // a block costs the next room's shield (Duster Coat balance)
      this.hurtT = 0.4;
      this.scene.fx.text(this.x, this.y - 70, 'BLOCKED', { color: '#8fc23f', size: 22 });
      Sfx.play('shop_deny', { vol: 0.5 });
      return false;
    }
    let rem = units;
    const t = Math.min(this.tin, rem);
    this.tin -= t; rem -= t;
    this.hp -= rem;
    this.hurtT = PLAYER.invulnAfterHit;
    this.firePoseT = 0;
    if (this.scene.run) this.scene.run.damageTaken += units;
    // knockback away from the source
    if (source.x != null) {
      const a = Math.atan2(this.y - source.y, this.x - source.x);
      this.knock.x = Math.cos(a) * 340; this.knock.y = Math.sin(a) * 340;
    }
    const fx = this.scene.fx;
    this.hurtFlashT = 0.12; // white silhouette flash
    fx.hitStop(70);
    fx.shake(0.01, 200);
    fx.flash(0xd63a2a, 0.55);
    fx.burst(this.x, this.y - 30, { color: [0x8a1c1c, 0xd63a2a], count: 12, speed: [80, 280], gravity: 200 });
    if (source.x != null) fx.burst(this.x, this.y - 30, { color: [0xd63a2a, 0xffb0a0], count: 6, speed: [160, 340], life: [150, 320], scale: [1, 2.4], blend: 'ADD', dir: Math.atan2(this.y - source.y, this.x - source.x), spread: 45 });
    fx.decal(this.x, this.y + 12, 'blood', 0.55);
    this.recomputeStats();
    bus.emit('player:hurt', { units, source, hp: this.hp, tin: this.tin });
    if (this.stats.dynamiteVestChance > 0 && rng.game.chance(this.stats.dynamiteVestChance)) {
      new Dynamite(this.scene, this.x, this.y, { fuse: 1.2, playerDamage: this.stats.explosionImmune ? 0 : 2 });
    }
    if (this.hp <= 0 && this.tin <= 0) { this.hp = 0; this.die(source); }
    return true;
  }

  die(source = {}) {
    if (this.dead) return;
    this.dead = true;
    this.rolling = false;
    this.deathT = 0;
    this.vx = this.vy = 0;
    if (this.scene.run) this.scene.run.killedBy = source.enemyName || source.kind || (source.explosion ? 'explosion' : 'the desert');
    bus.emit('player:died', { source });
    this.scene.onPlayerDied(source);
  }

  // ------------------------------------------------------------------------------------------------ pickups
  /** Try to collect a pickup type. Returns true when consumed. Room/pickup code calls this. */
  collect(type) {
    const max = PLAYER.maxPickups;
    switch (type) {
      case 'heart_full': if (this.hp >= this.maxHp) return false; this.heal(2); break;
      case 'heart_half': if (this.hp >= this.maxHp) return false; this.heal(1); break;
      case 'heart_tin': if (!this.addTin(2)) return false; break;
      case 'coin': if (this.coins >= max) return false; this.coins = Math.min(max, this.coins + this.stats.coinMult); break;
      case 'coin_nickel': if (this.coins >= max) return false; this.coins = Math.min(max, this.coins + 5 * this.stats.coinMult); break;
      case 'key': if (this.keys >= max) return false; this.keys++; break;
      case 'dynamite': if (this.dynamite >= max) return false; this.dynamite++; break;
      default: return false;
    }
    bus.emit('pickup:collected', { type });
    return true;
  }
  canCollect(type) {
    const max = PLAYER.maxPickups;
    switch (type) {
      case 'heart_full': case 'heart_half': return this.hp < this.maxHp;
      case 'heart_tin': return this.tin < Math.max(0, PLAYER.maxHearts - this.stats.maxHearts) * 2;
      case 'coin': case 'coin_nickel': return this.coins < max;
      case 'key': return this.keys < max;
      case 'dynamite': return this.dynamite < max;
      default: return false;
    }
  }
  price(base) { return Math.max(1, base - (this.stats.shopDiscount || 0)); }

  // ------------------------------------------------------------------------------------------------ scripted control
  setEntryInvuln(t = PLAYER.roomEntryInvuln) { this.entryInv = Math.max(this.entryInv, t); }
  /** Walk toward a direction for `t` seconds ignoring input (room entry). */
  forceWalk(dx, dy, t) { this.forced = { x: dx, y: dy, t }; this.rolling = false; }
  onRoomEntered() { if (this.shieldRest > 0) { this.shieldRest--; this.shieldLeft = 0; } else this.shieldLeft = this.stats.roomShield || 0; }
  teleport(x, y) { this.x = x; this.y = y; this.vx = this.vy = 0; this.knock.x = this.knock.y = 0; this.syncVisual(); }

  // ------------------------------------------------------------------------------------------------ update
  update(dt, input) {
    this.time += dt;
    if (this.dead) { this.updateDead(dt); return; }
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.entryInv > 0) this.entryInv -= dt;
    if (this.rollCd > 0) this.rollCd -= dt;
    if (this.firePoseT > 0) this.firePoseT -= dt;
    if (this.hurtFlashT > 0) this.hurtFlashT -= dt;
    const rollWasCd = this.rollCd > 0;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      b.t -= dt;
      if (b.t <= 0) { this.buffs.splice(i, 1); this.recomputeStats(); }
    }

    if (rollWasCd && this.rollCd <= 0 && !this.rolling) this.scene.fx.ringPulse(this.x, this.footY - 2, 0xf0a640, 34, 300, 0.75); // dodge ready
    const locked = this.locked;
    let move = { x: 0, y: 0 };
    let aim = null;
    if (this.forced) {
      move = { x: this.forced.x, y: this.forced.y };
      this.forced.t -= dt;
      if (this.forced.t <= 0) this.forced = null;
    } else if (!locked) {
      move = input.move;
      aim = input.aim(this);
    }
    const acting = !this.forced && !locked;
    if (!acting) { input.pressed('roll'); input.pressed('dyn'); input.pressed('active'); }

    // roll
    if (acting && !this.rolling && this.rollCd <= 0 && input.pressed('roll')) this.startRoll(move, aim);
    else if (acting) { input.pressed('roll'); }

    if (this.rolling) {
      this.rollT -= dt;
      const sp = this.stats.rollDistance / this.stats.rollDuration;
      // ease-out slightly: fast at start
      const k = clampN(this.rollT / this.stats.rollDuration, 0, 1);
      const mult = 0.7 + 0.6 * k;
      this.vx = this.rollDir.x * sp * mult;
      this.vy = this.rollDir.y * sp * mult;
      this.rollDustT -= dt;
      if (this.rollDustT <= 0) {
        this.rollDustT = 0.07; this.scene.fx.dust(this.x, this.footY, 0.7);
        this.scene.fx.afterimage(this.sprite, 0xf0d090, 0.38, 220);
      }
      if (this.rollT <= 0) { this.rolling = false; this.scene.fx.dust(this.x, this.footY, 0.6); this.rollCd = this.stats.rollCooldown; this.vx *= 0.3; this.vy *= 0.3; }
    } else {
      const sp = this.stats.moveSpeed;
      const tx = move.x * sp, ty = move.y * sp;
      const has = move.x !== 0 || move.y !== 0;
      const step = (has ? PLAYER.accel : PLAYER.friction) * dt;
      const dx = tx - this.vx, dy = ty - this.vy;
      const len = Math.hypot(dx, dy);
      if (len <= step) { this.vx = tx; this.vy = ty; } else { this.vx += (dx / len) * step; this.vy += (dy / len) * step; }
      // footstep dust
      if (has && Math.hypot(this.vx, this.vy) > sp * 0.6) {
        this._stepT = (this._stepT || 0) - dt;
        if (this._stepT <= 0) { this._stepT = 0.22; this.scene.fx.dust(this.x, this.footY, 0.45); }
      }
    }
    this.knock.x *= Math.exp(-dt * 9); this.knock.y *= Math.exp(-dt * 9);
    this.moveBy((this.vx + this.knock.x) * dt, (this.vy + this.knock.y) * dt);
    if (this.hit) {
      if (this.hnx * this.vx < 0) this.vx *= 0.2;
      if (this.hny * this.vy < 0) this.vy *= 0.2;
    }

    // actions
    if (acting && !this.rolling) {
      if (aim && this.fireCd <= 0) this.fire(aim);
      if (input.pressed('dyn')) this.placeDynamite(); 
      if (input.pressed('active')) this.useActive();
    } else if (acting) { input.pressed('dyn'); input.pressed('active'); }

    for (const f of this.familiars) f.update(dt, this, this.scene);

    // facing
    if (aim && !this.rolling) this.setFacingVec(aim.x, aim.y);
    else if (Math.abs(move.x) + Math.abs(move.y) > 0.1) this.setFacingVec(move.x, move.y);

    this.updateAnim(dt, move, aim);
    this.updateCooldownGfx();
    this.syncVisual();
  }

  syncVisual() {
    super.syncVisual();
    if (this.rolling && this.sprite) this.sprite.y = this.y - 8; // rolled ball is centre-anchored
  }

  setFacingVec(x, y) {
    if (Math.abs(x) > Math.abs(y)) this.facing = x < 0 ? 'left' : 'right';
    else this.facing = y < 0 ? 'up' : 'down';
  }

  startRoll(move, aim) {
    let d = null;
    if (move.x || move.y) d = move;
    else if (aim) d = aim;
    else d = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }[this.facing];
    const l = Math.hypot(d.x, d.y) || 1;
    this.rollDir = { x: d.x / l, y: d.y / l };
    this.rolling = true;
    this.rollT = this.stats.rollDuration;
    this.rollDustT = 0;
    this.knock.x = this.knock.y = 0;
    this.setFacingVec(this.rollDir.x, this.rollDir.y);
    this.scene.fx.dust(this.x, this.footY, 1);
    this.scene.fx.burst(this.x, this.footY, { color: [0xc8a878, 0x8a7458], count: 7, speed: [60, 200], life: [250, 500], scale: [0.09, 0.3], tex: 'glow', alpha: [0.45, 0], dir: Math.atan2(-this.rollDir.y, -this.rollDir.x), spread: 40 }); // kick-off burst behind us
    bus.emit('player:rolled', {});
  }

  // ------------------------------------------------------------------------------------------------ shooting
  fire(aim) {
    const s = this.stats;
    const scene = this.scene;
    const every = s.sixthEvery;
    const sixth = this.shotCount % every === every - 1;
    this.shotCount++;
    if (scene.run) scene.run.shots++;
    this.cylinder.loaded = every - (this.shotCount % every);
    if (this.cylinder.loaded === 1) Sfx.play('sixth_bullet_ready', { vol: 0.6 });
    let mult = s.bulletDamageMult;
    let pierce = s.pierce;
    let dead = false;
    if (sixth) { mult *= s.sixthMult; pierce += s.sixthPierce; }
    if (s.deadEye && this.time - this.lastShotAt > s.deadEyeDelay) { mult *= s.deadEye; pierce += 1; dead = true; }
    // luck crit (lucky_horseshoe etc.): small chance for x1.5 damage on normal shots
    const luckCrit = !sixth && !dead && s.luck > 0 && Math.random() < Math.min(0.3, s.luck * 0.03);
    if (luckCrit) mult *= 1.5;
    this.lastShotAt = this.time;
    const base = Math.atan2(aim.y, aim.x);
    const n = s.bulletCount;
    const perp = { x: -aim.y, y: aim.x };
    const inherit = (this.vx * perp.x + this.vy * perp.y) * 0.25;
    const size = s.bulletSize * (sixth ? 1.5 : 1);
    for (let i = 0; i < n; i++) {
      const off = (n === 1 ? 0 : (i - (n - 1) / 2) * rad(s.spreadDeg)) + (s.inaccuracy && !sixth ? rad((Math.random() * 2 - 1) * s.inaccuracy) : 0); // the Sixth Bullet is always accurate (fan_the_hammer)
      const a = base + off;
      const mx = this.x + Math.cos(a) * 30;
      const my = this.y + Math.sin(a) * 30 - 6;
      const b = scene.bullets.player.fire({
        x: mx, y: my, angle: a, speed: s.shotSpeed, damage: s.damage, mult, life: s.range,
        pierce, ricochet: s.ricochet, homing: s.homing, poison: s.poison,
        burn: s.burn && Math.random() < s.burn ? 1 : 0,
        fear: s.fearChance && rng.game.chance(s.fearChance) ? 1 : 0,
        size, sixth, source: this,
      });
      b.vx += perp.x * inherit; b.vy += perp.y * inherit;
      if (dead) { b.sprite.setTint(0xff9060); b.glow.setTint(0xff6030); b.streak.setTint(0xff6030); }
      else if (luckCrit) { b.sprite.setTint(0xffe070); b.glow.setTint(0xffd040); b.streak.setTint(0xffd040); }
      else if (!sixth) { // status bullets are colour-coded: burn orange, fear violet, poison green
        if (b.burn) { b.sprite.setTint(0xffe2b8); b.glow.setTint(0xff8030); b.streak.setTint(0xff8030); } else if (b.fear) { b.sprite.setTint(0xe0ccff); b.glow.setTint(0xa060ff); b.streak.setTint(0xa060ff); } else if (b.poison) { b.sprite.setTint(0xe4ffd0); b.glow.setTint(0x80d040); b.streak.setTint(0x80d040); } // pale slugs + coloured glow: never confusable with enemy embers/venom
      }
    }
    this.fireCd = s.fireDelay;
    this.firePoseT = 0.16;
    const mzx = this.x + aim.x * 44 + (aim.x === 0 ? 16 : 0), mzy = this.y - 30 + aim.y * 26; // vertical shots: gun hand is off to the side of the hat
    scene.fx.muzzle(mzx, mzy, base, sixth ? 1.5 : 1);
    scene.fx.smoke(mzx + aim.x * 10, mzy + aim.y * 6, sixth ? 3 : 1, sixth);
    scene.fx.casing(this.x + aim.x * 22, this.y + 12 + aim.y * 10, aim.x, aim.y);
    Sfx.play(sixth ? 'shoot_crit' : 'shoot', { vol: sixth ? 1 : 0.8, detune: (Math.random() - 0.5) * 200 });
    if (dead) { scene.fx.shake(0.006, 120); Sfx.play('shoot_crit', { vol: 0.7, rate: 0.85 }); }
    if (sixth) { scene.fx.shake(0.007, 120); this.knock.x -= aim.x * 120; this.knock.y -= aim.y * 120; }
    else { this.knock.x -= aim.x * 16; this.knock.y -= aim.y * 16; }
    bus.emit('player:fired', { sixth, count: this.cylinder.loaded });
  }

  placeDynamite() {
    if (this.dynamite <= 0) { Sfx.play('door_locked', { vol: 0.4, gap: 0.3 }); return false; }
    this.dynamite--;
    new Dynamite(this.scene, this.x, this.y, { fuse: this.stats.dynamiteFuse, playerDamage: this.stats.explosionImmune ? 0 : 2 });
    Sfx.play('gun_cock', { vol: 0.5 });
    return true;
  }

  // ------------------------------------------------------------------------------------------------ visuals
  updateAnim(dt, move, aim) {
    const sp = this.sprite;
    const s = this.scene;
    let alpha = 1;
    if (this.hurtT > 0 && !this.rolling) alpha = Math.floor(this.hurtT * 16) % 2 ? 0.35 : 1;
    sp.setAlpha(alpha);
    if (this.hurtFlashT > 0) { sp.setTintFill(0xffffff); this._flashed = true; alpha = 1; sp.setAlpha(1); } else if (this._flashed) { sp.clearTint(); this._flashed = false; }
    sp.setFlipX(this.facing === 'left');
    if (this.rolling) {
      const key = Assets.ensureAnim(s, 'player_roll', { fps: 16, name: 'roll' });
      this._play(key, 'player_roll');
      sp.setOrigin(0.5, 0.5);
      sp.setRotation(0);
      sp.setScale(1);
      return;
    }
    sp.setOrigin(0.5, Assets.anchor('player_walk_down') === 'bottom' ? 1 : 0.5);
    const dir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    const moving = Math.hypot(this.vx, this.vy) > 30;
    if (this.firePoseT > 0 && aim) {
      const idx = dir === 'down' ? 0 : dir === 'up' ? 1 : 2;
      this._pose('player_fire', idx);
    } else if (moving) {
      const key = Assets.ensureAnim(s, `player_walk_${dir}`, { fps: 12, name: 'walk' });
      this._play(key, `player_walk_${dir}`);
      sp.anims.timeScale = clampN(Math.hypot(this.vx, this.vy) / 330, 0.6, 1.5);
    } else {
      this._pose(`player_walk_${dir}`, 0);
    }
    const idle = !moving && !(this.firePoseT > 0);
    sp.setScale(1, idle ? 1 + Math.sin(this.time * 3) * 0.012 : 1);
  }
  _play(animKey, tex) {
    if (this._anim !== animKey) { this._anim = animKey; this.sprite.play(animKey, true); }
  }
  _pose(tex, frame) {
    const k = `pose:${tex}:${frame}`;
    if (this._anim !== k) {
      this._anim = k;
      this.sprite.anims.stop();
      Assets.tex(this.scene, tex);
      this.sprite.setTexture(tex, frame);
    }
  }

  updateCooldownGfx() {
    const g = this.cdGfx;
    g.clear();
    if (this.rollCd > 0 && !this.dead) {
      const p = 1 - this.rollCd / this.stats.rollCooldown;
      g.lineStyle(4, 0xf0a640, 0.75);
      g.beginPath();
      g.arc(this.x, this.footY - 2, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
      g.strokePath();
    }
  }

  updateDead(dt) {
    this.deathT += dt;
    const s = this.scene;
    const key = Assets.ensureAnim(s, 'player_death', { fps: 6, repeat: 0, name: 'die' });
    this._play(key, 'player_death');
    this.sprite.setOrigin(0.5, 1).setAlpha(1).setScale(1);
    this.cdGfx.clear();
    this.knock.x *= Math.exp(-dt * 9); this.knock.y *= Math.exp(-dt * 9);
    this.moveBy(this.knock.x * dt, this.knock.y * dt);
    this.syncVisual();
  }

  destroy() {
    for (const f of [...this.familiars]) if (f.destroy) f.destroy(); // copy: Familiar.destroy() removes itself from the list
    this.familiars.length = 0;
    this.cdGfx.destroy();
    super.destroy();
  }
}
