// Pooled bullet system (custom circle-vs-circle, no arcade bodies). scene.bullets = { player, enemy }
//
// PLAYER:  scene.bullets.player.fire({x,y,angle,speed,damage,mult,life,pierce,ricochet,homing,poison,burn,fear,spectral,size,sixth,
//                                    mods:{split,boomerang,orbit,chain,explode,ghost,pull,chill,reflected}, child, frame, hitCd, exclude, crit, dead, sxr, source})
//          returns null when the live-bullet caps refuse it (children > 90, everything >= 120). Behaviours (split, boomerang, orbit, chain, explode, pull,
//          smite, reflect, hellfire) are all resolved here from the per-bullet flags (ITEMS_V2 2.3).
// ENEMY:   scene.bullets.enemy.fire({x,y,angle|vx,vy,speed,damage,kind,radius,life,accel,curve,spectral,onDeath,...})
//          helpers: fan(base,n,spreadDeg), ring(base,n,offsetDeg), spiral(base,{count,stepDeg,interval,startAngle}), aimed(base, tx, ty)
// Bullets are visually lifted by `lift` px above their ground position (x,y is the ground-plane collision centre).
import Phaser from 'phaser';
import { DEPTH, ROOM, TILE, PLAYER, FEEL } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { rad } from '../core/util.js';
import { CTX, runHooks, hasHook } from '../items/hooks.js';
import { explode } from './Explosions.js';
import { smite, isUndead as isUndeadEnemy } from '../items/fx/Smite.js';

const CAP_ALL = 120, CAP_CHILD = 90, CAP_EXPLODE = 6;
const BOOM_OUT = 0.30, BOOM_BACK = 900, BOOM_LIFE = 1.8;
const ORBIT_R = 130, ORBIT_W = 5.5, ORBIT_MAX = 3;
/** Fallback look of the projectiles_v2 frames when that sheet is missing (base slug + tint). */
const V2 = {
  bullet_bone: { tint: 0xf0e8d0, glow: 0xf0e8d0 }, bullet_ghost: { tint: 0xb8ffe0, glow: 0x80ffc0 }, bullet_cap: { tint: 0xffb080, glow: 0xff8040 },
  bullet_orbit: { tint: 0xffe090, glow: 0xffc040 }, bullet_ice: { tint: 0xd0f0ff, glow: 0x9fd8ff }, bullet_coin: { tint: 0xffe070, glow: 0xffd040 },
  bullet_mirror: { tint: 0xe0f0ff, glow: 0xc0d8ff }, bullet_child: { tint: 0xffe8a0, glow: 0xffd070 },
};
const NO_MODS = {};
const SMITE_KILLS = []; // scratch: enemies killed by one smite

const ENEMY_KINDS = {
  enemy: { frame: 'bullet_enemy', r: 12, glow: 0xff5a2a, rotate: false },
  venom: { frame: 'bullet_venom', r: 12, glow: 0x8fc23f, rotate: false },
  nail: { frame: 'bullet_nail', r: 10, glow: 0xffa060, rotate: true },
  ghostfire: { frame: 'bullet_ghostfire', r: 13, glow: 0x6fe0d0, rotate: false },
  rock: { frame: 'rock_debris', r: 16, glow: 0xb09070, rotate: true },
  stick: { frame: 'dynamite_stick', r: 14, glow: 0xff5a2a, rotate: true },
};

class Bullet {
  constructor() {
    this.active = false; this.sprite = null; this.shadow = null; this.glow = null; this.streak = null;
    this.hit = new Set(); // enemies already hit (pierce); cleared on every fire()
    this.hitT = new Map(); // orbiters: enemy -> next age it may be hit again
    this.m = { split: 0, boom: false, orbit: 0, chain: false, explode: false, ghost: false, pull: false, chill: false, reflected: false }; // per-shot mods
    this.texKey = 'projectiles';
  }
}

class Pool {
  constructor(scene, owner) {
    this.scene = scene;
    this.owner = owner; // 'player' | 'enemy'
    this.isEnemyPool = owner === 'enemy';
    this.list = [];
    this.free = [];
    this.caps = 0; // blasting-cap explosions this frame
    this.frame = 0;
    this.picked = []; // scratch: chain targets
  }

  _get() {
    let b = this.free.pop();
    if (!b) {
      b = new Bullet();
      const s = this.scene;
      b.sprite = Assets.makeCell(s, 0, 0, 'projectiles', 'bullet_player', 0.5).setDepth(DEPTH.bullets);
      b.shadow = s.add.image(0, 0, 'shadow').setDepth(DEPTH.shadows + 1).setScale(0.22).setAlpha(0.7);
      b.glow = s.add.image(0, 0, 'glow').setDepth(DEPTH.bullets - 1).setBlendMode(Phaser.BlendModes.ADD);
      if (this.owner === 'player') b.streak = s.add.image(0, 0, 'fx_streak').setOrigin(1, 0.5).setDepth(DEPTH.bullets - 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    }
    return b;
  }

  /** Sprite frame for a player bullet: a projectiles_v2 cell (real art) or the base slug + a fallback tint. Returns the fallback {tint, glow} or null. */
  _skin(b, name) {
    const v2 = name && V2[name];
    let key = 'projectiles', frame;
    if (v2 && Assets.has('projectiles_v2')) { key = 'projectiles_v2'; frame = Assets.frame('projectiles_v2', name); } else frame = Assets.frame('projectiles', b.sixth ? 'bullet_crit' : 'bullet_player');
    if (b.texKey !== key) { b.sprite.setTexture(key); b.texKey = key; }
    b.sprite.setFrame(frame);
    return v2 && key === 'projectiles' ? v2 : null;
  }

  /** Fires one bullet; returns the bullet object (live until it dies; do not keep references after `active` is false), or null when refused by a cap. */
  fire(o) {
    const isEnemy = this.isEnemyPool;
    if (!isEnemy && (o.child ? this.list.length > CAP_CHILD : this.list.length >= CAP_ALL)) return null;
    const b = this._get();
    const kind = isEnemy ? ENEMY_KINDS[o.kind || 'enemy'] || ENEMY_KINDS.enemy : null;
    const sc = this.scene;
    let vx, vy;
    const speed = o.speed ?? (isEnemy ? 300 : 780);
    if (o.vx != null || o.vy != null) { vx = o.vx ?? 0; vy = o.vy ?? 0; } else { vx = Math.cos(o.angle ?? 0) * speed; vy = Math.sin(o.angle ?? 0) * speed; }
    if (isEnemy && !o.noScale) { // difficulty / mutator bullet speed
      const k = (sc.diff ? sc.diff.mul('bulletSpeed') : 1) * ((sc.mut && sc.mut.enemyBulletSpeed) || 1);
      if (k !== 1) { vx *= k; vy *= k; }
    }
    const mo = o.mods || NO_MODS;
    b.active = true;
    b.team = this.owner;
    b.owner = o.owner || null; // enemy that fired it (Affixes: vampiric)
    b.kind = o.kind || (isEnemy ? 'enemy' : o.sixth ? 'crit' : 'player');
    b.x = o.x; b.y = o.y; b.vx = vx; b.vy = vy;
    b.dmg = o.damage ?? 1;
    b.age = 0;
    b.life = o.life ?? (isEnemy ? 4 : 0.55);
    b.size = o.size ?? 1;
    b.r = (o.radius ?? (isEnemy ? kind.r : 10)) * (isEnemy ? 1 : b.size);
    b.pierce = o.pierce ?? 0;
    b.ricochet = o.ricochet ?? 0;
    b.homing = o.homing ?? 0;
    b.poison = o.poison ?? 0;
    b.burn = o.burn ?? 0;
    b.fear = o.fear ?? 0;
    b.spectral = !!o.spectral;
    b.sixth = !!o.sixth;
    b.mult = o.mult ?? 1;
    b.accel = o.accel ?? 0;
    b.curve = rad(o.curve ?? 0);
    b.onDeath = o.onDeath || null;
    b.onHit = o.onHit || null;
    b.source = o.source || null;
    let famSpec = false;
    if (!isEnemy && b.source && b.source.isFamiliar && sc.player) { // familiar shots: Pack Leader damage, Spectral Posse passes rocks
      const ps = sc.player.stats;
      b.dmg *= ps.familiarMult;
      famSpec = !!ps.spectralFamiliars;
    }
    b.lift = o.lift ?? 30;
    b.rotate = o.rotate ?? (isEnemy ? kind.rotate : true); // player slugs point along their travel
    b.hit.clear();
    b.trailT = 0;
    b.data = o.data || null;
    b.noObstacle = !!o.noObstacle || famSpec; // ignore obstacles (still dies on walls)
    b.noWall = !!o.noWall; // ignore room walls (dies only on life)
    b.hitsPlayer = o.hitsPlayer ?? true;
    // ---- item mods (player bullets)
    const m = b.m;
    m.split = mo.split || 0; m.boom = !!mo.boomerang; m.orbit = mo.orbit || 0; m.chain = !!mo.chain; m.explode = !!mo.explode; m.ghost = !!mo.ghost;
    m.pull = !!mo.pull; m.chill = !!(mo.chill || o.chill); m.reflected = !!mo.reflected;
    b.child = !!o.child; b.crit = !!o.crit; b.dead = !!o.dead; b.charged = false; b.nHit = 0; b.sxr = o.sxr || 0; b.chainT = -1; b.phase = 0;
    b.hitCd = o.hitCd || 0; b.hitT.clear();
    b.v0 = Math.hypot(vx, vy) || 1; b.bx = vx / b.v0; b.by = vy / b.v0; // launch direction (boomerang)
    if (o.exclude) b.hit.add(o.exclude);
    if (m.ghost) { b.spectral = true; b.pierce += 1; b.dmg *= 1.15; }
    let frameName = o.frame || (m.boom ? 'bullet_bone' : m.orbit ? 'bullet_orbit' : m.ghost ? 'bullet_ghost' : m.explode ? 'bullet_cap' : m.chill ? 'bullet_ice' : null);
    if (m.boom) { b.pierce = 9999; b.size = 1.25; b.r = 10 * 1.25; b.life = BOOM_LIFE; b.rotate = false; }
    if (m.orbit) {
      const pl = sc.player;
      b.pierce = 9999; b.noObstacle = true; b.noWall = true; b.spectral = true; b.life = m.orbit; b.hitCd = 0.35; b.oa = Math.atan2(o.y - pl.y, o.x - pl.x); b.rotate = true;
      const ol = pl.orbiters;
      ol.push(b);
      while (ol.length > ORBIT_MAX) this.kill(ol[0], 'expire', true); // oldest expires
    }

    let fb = null;
    if (isEnemy) b.sprite.setFrame(Assets.frame('projectiles', kind.frame));
    else fb = this._skin(b, frameName);
    b.sprite.setVisible(true).setAlpha(o.alpha ?? (m.ghost ? 0.75 : 1));
    b.sprite.setScale((o.scale ?? 1) * (isEnemy ? 1 : b.size * FEEL.playerBulletScale * (b.sixth ? 1.25 : 1)));
    b.sprite.setRotation(b.rotate ? Math.atan2(vy, vx) : 0);
    b.sprite.clearTint();
    const tint = o.tint ?? (m.ghost ? 0xb8ffe0 : fb ? fb.tint : null);
    if (tint != null) b.sprite.setTint(tint);
    b.shadow.setVisible(true);
    b.glow.setVisible(true);
    const gc = isEnemy ? kind.glow : fb ? fb.glow : b.sixth ? 0xffc040 : 0xfff2c0;
    b.glow.setTint(gc).setScale(isEnemy ? 0.55 : (b.sixth ? 0.85 : 0.5) * Math.min(1.6, b.size)).setAlpha(isEnemy ? 0.65 : b.sixth ? 0.55 : 0.4);
    if (!isEnemy) {
      // brass streak behind the slug (gold + longer for the Sixth Bullet); tinted per shot below via b.glow tint
      const len = Math.max(18, Math.hypot(vx, vy) * FEEL.streakLen * (b.sixth ? 1.7 : 1));
      b.streak.setVisible(true).setTint(gc).setAlpha(b.sixth ? 0.7 : 0.42).setDisplaySize(len, (b.sixth ? 11 : 7) * Math.min(1.6, b.size));
    }
    this._place(b);
    this.list.push(b);
    if (bus.listenerCount('bullet:fired') > 0) bus.emit('bullet:fired', { bullet: b, sixth: b.sixth, owner: this.owner }); // skip the per-shot allocation when nobody listens
    return b;
  }

  _place(b) {
    const y = b.y - b.lift;
    b.sprite.setPosition(b.x, y);
    b.glow.setPosition(b.x, y);
    if (!this.isEnemyPool) { b.streak.setPosition(b.x, y); b.streak.setRotation(Math.atan2(b.vy, b.vx)); }
    b.shadow.setPosition(b.x, b.y + 6);
  }

  kill(b, reason = 'life', silent = false) {
    if (!b.active) return;
    b.active = false;
    b.sprite.setVisible(false);
    b.shadow.setVisible(false);
    b.glow.setVisible(false);
    if (b.streak) b.streak.setVisible(false);
    const s = this.scene;
    if (!silent && (reason === 'wall' || reason === 'obstacle' || reason === 'hit' || reason === 'life')) {
      const ang = Math.atan2(b.vy, b.vx);
      if (reason !== 'life' || this.owner === 'player') s.fx.impact(b.x, b.y - b.lift, ang, this.owner === 'enemy' ? 0.8 : b.sixth ? 1.3 : 0.9);
      if (reason === 'wall' || reason === 'obstacle') Sfx.play('bullet_hit_wall', { vol: 0.6, detune: (Math.random() - 0.5) * 300 });
    }
    if (b.m.orbit) { const ol = s.player && s.player.orbiters; if (ol) { const i = ol.indexOf(b); if (i >= 0) ol.splice(i, 1); } }
    // reason 'clear' = silent teardown (room change / boss death): never run callbacks that could spawn things.
    // NOTE: the bullet stays in `list` (inactive) until the end-of-frame compaction returns it to `free`; recycling it
    // immediately would let fire() (e.g. from an onDeath callback) re-activate a stale list slot -> the bullet would be updated twice.
    if (!this.isEnemyPool && reason !== 'clear' && s.player && hasHook(s.player, 'bulletEnd')) { const c = CTX.bulletEnd; c.b = b; c.reason = reason; runHooks(s.player, 'bulletEnd', c); c.b = null; }
    if (b.onDeath && reason !== 'clear') { try { b.onDeath(b, reason); } catch (e) { console.error(e); } }
    b.onDeath = null; b.onHit = null; b.source = null; b.data = null; b.owner = null;
  }

  clear() {
    for (const b of this.list) { this.kill(b, 'clear', true); this.free.push(b); }
    this.list.length = 0;
    if (this.scene.player && this.scene.player.orbiters) this.scene.player.orbiters.length = 0;
  }

  /** Kill enemy bullets within radius of a point (silent). */
  clearRadius(x, y, r) {
    for (const b of this.list) if (b.active && Math.hypot(b.x - x, b.y - y) < r) this.kill(b, 'clear', true);
  }

  update(dt) {
    const s = this.scene;
    const room = s.room;
    const list = this.list;
    const isEnemy = this.isEnemyPool;
    const player = s.player;
    this.caps = 0;
    this.frame++;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) continue;
      // steering
      if (b.accel) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const ns = Math.max(0, sp + b.accel * dt);
        b.vx *= ns / sp; b.vy *= ns / sp;
      }
      if (b.curve) {
        const c = Math.cos(b.curve * dt), sn = Math.sin(b.curve * dt);
        const nx = b.vx * c - b.vy * sn;
        b.vy = b.vx * sn + b.vy * c; b.vx = nx;
      }
      if (b.homing > 0 && !isEnemy) this._home(b, dt);
      if (b.homing > 0 && isEnemy && player) this._homeTo(b, player.x, player.y, b.homing, dt);
      if (!isEnemy && player) {
        if (b.m.boom) { if (this._boomerang(b, dt, player)) continue; } else if (b.m.orbit) this._orbit(b, dt, player);
        if (b.m.pull) this._pull(b, dt, player.stats);
      }
      if (!b.m.orbit) { b.x += b.vx * dt; b.y += b.vy * dt; } // orbiters are placed by _orbit
      b.age += dt;
      if (b.m.boom) b.sprite.setRotation(b.age * 16); else if (b.rotate) b.sprite.setRotation(Math.atan2(b.vy, b.vx));
      if (b.sixth && b.age - b.trailT > 0.03) { b.trailT = b.age; s.fx.burst(b.x, b.y - b.lift, { color: [0xffb030, 0xffe090], count: 1, speed: [0, 30], life: [180, 340], scale: [1, 3.6], blend: 'ADD' }); }
      if (b.age >= b.life) { this.kill(b, 'life'); continue; }

      // room bounds
      if (!b.noWall) {
        let bounced = false, hitWall = false;
        if (b.x - b.r < ROOM.x) { b.x = ROOM.x + b.r; if (b.ricochet > 0) { b.vx = Math.abs(b.vx); bounced = true; } else hitWall = true; }
        else if (b.x + b.r > ROOM.right) { b.x = ROOM.right - b.r; if (b.ricochet > 0) { b.vx = -Math.abs(b.vx); bounced = true; } else hitWall = true; }
        if (!hitWall) {
          if (b.y - b.r < ROOM.y) { b.y = ROOM.y + b.r; if (b.ricochet > 0) { b.vy = Math.abs(b.vy); bounced = true; } else hitWall = true; }
          else if (b.y + b.r > ROOM.bottom) { b.y = ROOM.bottom - b.r; if (b.ricochet > 0) { b.vy = -Math.abs(b.vy); bounced = true; } else hitWall = true; }
        }
        if (hitWall) {
          if (b.m.boom) { this._turn(b); } else {
            if (!isEnemy && room && room.onWallHit) room.onWallHit(b.x, b.y); // brittle secret doors (EVENTS 8.2)
            this.kill(b, 'wall'); continue;
          }
        }
        if (bounced) { b.ricochet--; b.sprite.setRotation(b.rotate ? Math.atan2(b.vy, b.vx) : 0); s.fx.impact(b.x, b.y - b.lift, 0, 0.6); Sfx.play('bullet_hit_wall', { vol: 0.4 }); if (!isEnemy) this._bounced(b, player); }
      }

      // obstacles
      if (room && !b.spectral && !b.noObstacle) {
        const tile = room.bulletBlock(b.x, b.y, b.r * 0.8);
        if (tile) {
          if (!isEnemy && tile.type === 'breakable') room.damageTile(tile, 1, b);
          if (b.m.boom) this._turn(b);
          else if (b.ricochet > 0 && tile.type !== 'breakable') {
            this._reflectTile(b, tile);
            b.ricochet--;
            if (!isEnemy) this._bounced(b, player);
          } else { this.kill(b, 'obstacle'); continue; }
        }
      }

      if (isEnemy) {
        // reflect: a rolling player with hand_mirror throws the bullet back
        if (player && player.rolling && player.stats.rollReflect > 0) {
          const rr = player.stats.rollReflect + b.r;
          if ((player.x - b.x) ** 2 + (player.y - b.y) ** 2 < rr * rr) { this._reflect(b, player); continue; }
        }
        // familiars / shields that block bullets
        let blocked = false;
        for (const f of player ? player.familiars : []) {
          if (f.blocksBullets && Math.hypot(f.x - b.x, f.y - b.y) < (f.radius || 30) + b.r) { blocked = true; if (f.onBlock) f.onBlock(b); break; }
        }
        if (blocked) { this.kill(b, 'hit'); continue; }
        if (player && b.hitsPlayer && player.canBeHit()) {
          const rr = player.hurtRadius + b.r * 0.6;
          if ((player.x - b.x) ** 2 + (player.y - b.y) ** 2 < rr * rr) {
            player.damage(b.dmg, { x: b.x, y: b.y, bullet: b, kind: b.kind, enemy: b.owner || undefined });
            this.kill(b, 'hit');
            continue;
          }
        }
      } else {
        if (b.m.orbit) this._orbitWipe(b);
        if (this._hitEnemies(b, player)) { this.kill(b, 'hit'); continue; }
      }
      this._place(b);
    }
    // compact
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.active) list[w++] = b; else this.free.push(b);
    }
    list.length = w;
  }

  // --------------------------------------------------------------------- player bullet behaviours (ITEMS_V2 2.3)
  /** Player bullet vs enemies. Returns true when the bullet is spent. */
  _hitEnemies(b, player) {
    const enemies = this.scene.enemies;
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (!e.alive || !e.targetable) continue;
      if (b.hit.has(e)) continue;
      if (b.hitCd) { const nt = b.hitT.get(e); if (nt !== undefined && nt > b.age) continue; }
      const rr = e.hitRadius + b.r;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) continue;
      const tot = b.dmg * b.mult;
      const res = e.takeHit(tot, { x: b.x, y: b.y, angle: Math.atan2(b.vy, b.vx), bullet: b, sixth: b.sixth, deadEye: b.dead, poison: b.poison, burn: b.burn, fear: b.fear, chill: b.m.chill, knock: b.sixth ? 1.6 : 1, familiar: !!(b.source && b.source.isFamiliar), source: b.source });
      if (res === 'ignore') continue;
      b.nHit++;
      if (b.onHit) b.onHit(b, e);
      if (player && !b.child && b.source === player) this._afterHit(b, e, tot, player);
      else if (player && b.source && b.source.isFamiliar && player.stats.familiarInherit) this._inherit(b, e, player);
      if (b.hitCd) b.hitT.set(e, b.age + b.hitCd);
      else if (b.pierce > 0) { b.pierce--; b.hit.add(e); } else return true;
      return false;
    }
    return false;
  }

  /** Item reactions to a landed hit: hooks, chain, explosions, hellfire, split, smite, sacrament, coins. */
  _afterHit(b, e, tot, player) {
    const st = player.stats, sc = this.scene, m = b.m;
    if (b.crit && st.critCoinChance > 0 && sc.room && player.crng.chance(st.critCoinChance)) sc.room.dropPickup('coin', e.x, e.y, { pop: true });
    if (st.elemPoisonExtra > 0 && e.alive && b.poison && player.crng.chance(st.elemPoisonExtra)) e.applyStatus('poison', { dps: b.poison, t: 3, max: st.poisonStackMax });
    if (b.sixth && b.nHit === 2 && st.sacrament) { player.addCharge(1); sc.fx.text(e.x, e.y - 70, '+1 CHARGE', { color: '#ffc040', size: 20 }); }
    if (b.sxr > 0 && !b.sxDone) { // hellfire round: the Sixth Bullet detonates on the first enemy it hits, and keeps flying
      b.sxDone = true;
      explode(sc, b.x, b.y, { radius: b.sxr, damage: tot, hurtPlayer: false, breakObstacles: false, revealSecrets: false, source: 'sixth', owner: 'player', burn: 2.5, exclude: e, sixth: !!st.sixthBlastKills, noFire: true, noCluster: true });
    }
    if (m.chain && sc.time.now / 1000 - b.chainT >= 0.05) this._chain(b, e, tot, player);
    if (m.explode && this.caps < CAP_EXPLODE) {
      this.caps++;
      explode(sc, b.x, b.y, { radius: st.explodeRadius, damage: tot * st.explodeMult, hurtPlayer: false, breakObstacles: false, revealSecrets: false, shake: false, source: 'cap', owner: 'player', exclude: e, noFire: true, noCluster: true });
    }
    if (m.split > 0) { this._split(b, e, player); m.split = 0; }
    if (st.smiteChance > 0 && sc.time.now >= player._smiteAt && player.crng.chance(st.smiteChance)) {
      player._smiteAt = sc.time.now + 400;
      smite(sc, e.x, e.y, st.damage * st.smiteMult, st.smiteRadius, SMITE_KILLS);
      if (st.smiteHeartDrop > 0 && sc.room) for (let k = 0; k < SMITE_KILLS.length; k++) if (isUndeadEnemy(SMITE_KILLS[k]) && player.crng.chance(st.smiteHeartDrop)) sc.room.dropPickup('heart_half', SMITE_KILLS[k].x, SMITE_KILLS[k].y, { pop: true });
      SMITE_KILLS.length = 0;
    }
    if (hasHook(player, 'hit')) {
      const c = CTX.hit; c.b = b; c.enemy = e; c.dealt = tot; c.sixth = b.sixth; c.killed = !e.alive;
      runHooks(player, 'hit', c); c.b = null; c.enemy = null;
    }
  }

  /** Pack Leader: familiar shots carry the owner's burn / poison / chill / fear. */
  _inherit(b, e, player) {
    const st = player.stats;
    if (!e.alive) return;
    if (st.burn > 0 && player.crng.chance(st.burn)) e.applyStatus('burn', { dps: 3 * st.burnDpsMult, t: 2.5 });
    if (st.poison > 0) e.applyStatus('poison', { dps: st.poison, t: 3, max: st.poisonStackMax });
    if (st.chillChance > 0 && player.crng.chance(st.chillChance)) e.applyStatus('chill', { t: 3 });
    if (st.fearChance > 0 && !e.isBoss && player.crng.chance(st.fearChance)) e.applyStatus('fear', { t: 2 });
  }

  /** Lightning: up to chainCount other enemies within chainRange of the victim take chainMult of the hit. */
  _chain(b, victim, tot, player) {
    const st = player.stats, sc = this.scene, enemies = sc.enemies, used = this.picked;
    used.length = 0;
    b.chainT = sc.time.now / 1000;
    const n = st.chainCount + (b.charged ? 1 : 0);
    const range2 = st.chainRange * st.chainRange;
    for (let k = 0; k < n; k++) {
      let best = null, bd = range2;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (!e.alive || !e.targetable || e === victim || used.includes(e)) continue;
        const d2 = (e.x - victim.x) ** 2 + (e.y - victim.y) ** 2;
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (!best) break;
      used.push(best);
      sc.fx.arc(victim.x, victim.y - 30, best.x, best.y - 30, { color: 0xfff2a0, ms: 120 });
      best.takeHit(tot * st.chainMult, { x: victim.x, y: victim.y, angle: Math.atan2(best.y - victim.y, best.x - victim.x), knock: 0.3, chain: true, source: b.source });
    }
    used.length = 0;
  }

  /** Forked Tongue: `split` children fanned +-35 degrees around the travel angle, 0.8x speed, life 0.35 s, splitMult x damage; never re-split. */
  _split(b, victim, player) {
    const n = b.m.split;
    const st = player.stats;
    const a0 = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy) * 0.8;
    for (let i = 0; i < n; i++) {
      const a = a0 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * rad(70));
      this.fire({
        x: b.x, y: b.y, angle: a, speed: sp, damage: b.dmg, mult: b.mult * st.splitMult, life: 0.35, size: 0.7, child: true, frame: 'bullet_child',
        poison: b.poison, burn: b.burn, fear: b.fear, chill: b.m.chill, exclude: victim, source: b.source, crit: false,
      });
    }
  }

  /** Bounced off a wall / obstacle: bounce hook + Static Ricochet (the bullet becomes charged: its next hit always chains, +1 target). */
  _bounced(b, player) {
    if (!player || b.team !== 'player') return;
    if (player.stats.staticRicochet) { b.m.chain = true; b.charged = true; b.sprite.setTint(0xfff2a0); b.glow.setTint(0xffe070); b.streak.setTint(0xffe070); }
    if (hasHook(player, 'bounce')) { CTX.bounce.b = b; runHooks(player, 'bounce', CTX.bounce); CTX.bounce.b = null; }
  }

  /** Bone boomerang: out 0.30 s decelerating to 0, then home to the player at 900 px/s. Returns true when it was caught (killed). */
  _boomerang(b, dt, player) {
    if (b.phase === 0) {
      if (b.age >= BOOM_OUT) { this._turn(b); } else { const k = Math.max(0, 1 - b.age / BOOM_OUT); b.vx = b.bx * b.v0 * k; b.vy = b.by * b.v0 * k; return false; }
    }
    const dx = player.x - b.x, dy = player.y - 6 - b.y, d = Math.hypot(dx, dy) || 1;
    if (d < 40) { this.kill(b, 'catch', true); return true; }
    b.vx = (dx / d) * BOOM_BACK; b.vy = (dy / d) * BOOM_BACK;
    return false;
  }
  _turn(b) { if (b.phase === 0) { b.phase = 1; b.hit.clear(); } }

  /** Carousel slug: circles the player at r 130, 5.5 rad/s. */
  _orbit(b, dt, player) {
    b.oa += ORBIT_W * dt;
    const nx = player.x + Math.cos(b.oa) * ORBIT_R, ny = player.y - 6 + Math.sin(b.oa) * ORBIT_R;
    b.vx = (nx - b.x) / Math.max(dt, 1e-4); b.vy = (ny - b.y) / Math.max(dt, 1e-4); // tangential velocity (sprite / streak direction)
    b.x = nx; b.y = ny;
  }
  _orbitWipe(b) {
    const eb = this.scene.bullets.enemy.list;
    for (let i = 0; i < eb.length; i++) { const e = eb[i]; if (e.active && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < 26 * 26) this.scene.bullets.enemy.kill(e, 'hit'); }
  }

  /** Lodestone: enemies within pullRadius are dragged toward the bullet (bosses / heavy immune; x2 for the Sixth; once per enemy per frame). */
  _pull(b, dt, st) {
    const enemies = this.scene.enemies, r2 = st.pullRadius * st.pullRadius, sp = st.pullSpeed * (b.sixth ? 2 : 1) * dt;
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (!e.alive || e.isBoss || (e.meta && e.meta.heavy) || e._pullF === this.frame) continue;
      const dx = b.x - e.x, dy = b.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 < 400) continue;
      const d = Math.sqrt(d2);
      e._pullF = this.frame;
      e.moveBy((dx / d) * sp, (dy / d) * sp);
    }
  }

  /** Hand Mirror: an enemy bullet meeting a rolling player flies back as a player bullet at the nearest foe. */
  _reflect(b, player) {
    const sc = this.scene;
    this.kill(b, 'clear', true);
    let best = null, bd = Infinity;
    for (const e of sc.enemies) { if (!e.alive || !e.targetable) continue; const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2; if (d < bd) { bd = d; best = e; } }
    const a = best ? Math.atan2(best.y - b.y, best.x - b.x) : Math.atan2(-b.vy, -b.vx);
    sc.bullets.player.fire({ x: b.x, y: b.y, angle: a, speed: 900, damage: player.stats.damage, life: 0.9, spectral: true, child: true, frame: 'bullet_mirror', mods: { reflected: true }, source: player });
    sc.fx.ringPulse(b.x, b.y - b.lift, 0xc0d8ff, 40, 260, 0.8);
    Sfx.play('bullet_hit_wall', { vol: 0.5, rate: 1.6 });
  }

  _home(b, dt) {
    const enemies = this.scene.enemies;
    let best = null, bd = 520 * 520;
    const ang = Math.atan2(b.vy, b.vx);
    for (const e of enemies) {
      if (!e.alive || !e.targetable) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > bd) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang)) > 1.3) continue;
      bd = d2; best = e;
    }
    if (best) this._homeTo(b, best.x, best.y, b.homing, dt);
  }
  _homeTo(b, tx, ty, strength, dt) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const cur = Math.atan2(b.vy, b.vx);
    const want = Math.atan2(ty - b.y, tx - b.x);
    const d = Phaser.Math.Angle.Wrap(want - cur);
    const step = Math.max(-1, Math.min(1, d / 0.3)) * strength * 6 * dt;
    const na = cur + Math.max(-Math.abs(d), Math.min(Math.abs(d), step));
    b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
  }
  _reflectTile(b, tile) {
    const rx = ROOM.x + tile.c * TILE, ry = ROOM.y + tile.r * TILE;
    const qx = Phaser.Math.Clamp(b.x, rx, rx + TILE), qy = Phaser.Math.Clamp(b.y, ry, ry + TILE);
    let nx = b.x - qx, ny = b.y - qy;
    const d = Math.hypot(nx, ny);
    if (d < 0.001) { nx = b.vx > 0 ? -1 : 1; ny = 0; } else { nx /= d; ny /= d; }
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
    b.x = qx + nx * (b.r + 2); b.y = qy + ny * (b.r + 2);
  }

  // --------------------------------------------------------------------- enemy pattern helpers
  /** n bullets fanned around base.angle (or toward base.tx,ty), total spread in degrees. */
  fan(base, n, spreadDeg, angle) {
    const a0 = angle ?? base.angle ?? 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * rad(spreadDeg);
      out.push(this.fire({ ...base, angle: a0 + off, vx: undefined, vy: undefined }));
    }
    return out;
  }
  /** n bullets evenly around a circle. */
  ring(base, n, offsetDeg = 0) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.fire({ ...base, angle: rad(offsetDeg) + (i / n) * Math.PI * 2, vx: undefined, vy: undefined }));
    return out;
  }
  /** Bullet aimed at a point. */
  aimed(base, tx, ty, extraDeg = 0) {
    return this.fire({ ...base, angle: Math.atan2(ty - base.y, tx - base.x) + rad(extraDeg), vx: undefined, vy: undefined });
  }
  /** Timed spiral: fires `count` bullets, one every `interval` s, rotating by stepDeg. Returns {cancel()}. */
  spiral(base, { count = 16, stepDeg = 22, interval = 0.08, startAngle = 0, arms = 1 } = {}) {
    let i = 0;
    const ev = this.scene.time.addEvent({
      delay: interval * 1000, repeat: count - 1,
      callback: () => {
        for (let k = 0; k < arms; k++) this.fire({ ...base, x: base.getX ? base.getX() : base.x, y: base.getY ? base.getY() : base.y, angle: rad(startAngle + i * stepDeg) + (k / arms) * Math.PI * 2, vx: undefined, vy: undefined });
        i++;
      },
    });
    return { cancel: () => ev.remove() };
  }
}

export default class Bullets {
  constructor(scene) {
    this.scene = scene;
    this.player = new Pool(scene, 'player');
    this.enemy = new Pool(scene, 'enemy');
  }
  update(dt) {
    this.player.update(dt);
    this.enemy.update(dt);
  }
  clear() { this.player.clear(); this.enemy.clear(); }
  get count() { return this.player.list.length + this.enemy.list.length; }
}
